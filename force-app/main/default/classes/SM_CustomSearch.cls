/*******************************************************************************************************
* Class Name      	: SM_CustomSearch
* Description		: Domain / Service layer for custom search of sobject. MUST Use with sharing.
* Author          	: Simplus - Yi Zhang
* Created On      	: 31/07/2020
* Modification Log	:
* -----------------------------------------------------------------------------------------------------
* Developer				Date			Modification ID		Description
* -----------------------------------------------------------------------------------------------------
* Yi Zhang              31/07/2020		1000				Initial version
******************************************************************************************************/
public with sharing class SM_CustomSearch {
    
    private static final Integer MAX_RESULTS = 5;
    private static final Integer QUERY_LIMIT = 25;
    private static final Map<String, String> OPERATOR_MAP = new Map<String, String>{
        'equals' => '=', 
        'greater than'=> '>', 
        'less than'=> '<', 
        'equal to blank' => '= NULL', 
        'not equal to blank'=>'!=NULL',
        'contains'=> 'LIKE'};
    private static final List<String> IGNORE_VALUE_OPERATORS = new List<String>{'equal to blank', 'not equal to blank'};
    private static final String OPERATOR_CONTAINS = 'contains';

    /**
    * @description 
    * @author Yi Zhang | 07/08/2020 
    * @param objectApiName 
    * @return CustomSearchWrapper 
    **/
    @AuraEnabled(cacheable=true)
    public static CustomSearchWrapper init(String objectApiName, String runningUserId) {
        // System.debug('objectApiName: ' + objectApiName);
        CustomSearchWrapper response = new CustomSearchWrapper();

        response.queryLimit = QUERY_LIMIT;

        // set label & pural labels
        Map<String, Schema.SObjectType> gd = Schema.getGlobalDescribe();
        if(gd.containsKey(objectApiName)) {
            Schema.DescribeSObjectResult dsr = gd.get(objectApiName).getDescribe();
            response.objectLabel = dsr.getLabel();
            response.objectLabelPlural = dsr.getLabelPlural();
        }


        User user = [SELECT Id, Profile.Name FROM User WHERE Id = :runningUserId];
        // String currencyCode = user.LocaleSidKey == 'en_NZ' ? 'NZD' : 'AUD';
        // get display fields
        List<Custom_Search_Field__mdt> fieldData = DM_CustomSearchField.customSearchFieldDataByObject(objectApiName);
        response.displayFields = new List<Field>();
        response.filterFields  = new List<Field>();
        for(Custom_Search_Field__mdt csf : fieldData) {
            // display fields
            if(csf.Display_Field__c == true) {
                Field f = new Field();
                f.label = csf.Field__r.Label;
                f.fieldName = csf.Field__r.QualifiedApiName;
                f = setFieldFlags(objectApiName, f);
                f = setFieldType(objectApiName, f);
                f.editable = (csf.Editable__c == true && csf.Editable_By__c.contains(user.Profile.Name));
                f.sortable = true;
                if(f.type == 'currency') {
                    // f.typeAttributes = new Map<String, String>{'currencyCode'=>currencyCode};
                }

                response.displayFields.add(f);
            }

            // filter fields
            if(csf.Filter_Field__c == true) {
                Field f = new Field();
                f.label = csf.Field__r.Label;
                f.fieldName = csf.Field__r.QualifiedApiName;
                f.operators = csf.Operators__c;
                f = setFieldFlags(objectApiName, f);
                f = setFieldType(objectApiName, f);
                f = specialFieldOverride(f);
                response.filterFields.add(f);
            }
        }

        response = includeManualFields(response);

        // add default filter(s)
        response = addDefaultFilters(response, null);

        // add initial data
        response.data = getRecords(objectApiName, response.displayFields, response.defaultFilters, 0, QUERY_LIMIT, null, null);

        // tweak fieldName for reference field
        for(Field f : response.displayFields) {
            if(f.isReference == true && f.fieldName.endsWith('Id')) {
                f.fieldName = f.fieldName.substring(0, f.fieldName.length() - 2) + '.Name';
            }
        }
        return response;
    }

    /**
    * @description 
    * @author Yi Zhang | 10/08/2020 
    * @param objectApiName 
    * @param fields 
    * @param filters 
    * @param offset 
    * @param recordLimit 
    * @param sortBy 
    * @param sortDirection 
    * @return List<Sobject> 
    **/
    @AuraEnabled
    public static List<Sobject> getRecords(String objectApiName, List<Field> fields, List<Field> filters, Integer offset, Integer recordLimit, String sortBy, String sortDirection){
        System.debug(LoggingLevel.DEBUG, fields);
        System.debug(LoggingLevel.DEBUG, filters);
        String sorting = (sortBy != null && sortDirection != null) ? (' ORDER BY ' + sortBy + ' ' + sortDirection + ' ') : '';
        if(sortDirection == 'desc') {
            sorting += '  NULLS last';
        }
        String query = 'SELECT ' + fieldsToQueryFields(fields) 
        + ' FROM ' + objectApiName + ' ' 
        + filtersToWhereClauses(filters) 
        + sorting
        + ' LIMIT :recordLimit OFFSET :offset';
        System.debug(LoggingLevel.DEBUG, query);
        List<Sobject> results = Database.query(query);
        return results;
    }

    /**
    * @description 
    * @author Yi Zhang | 11/08/2020 
    * @param fields 
    * @param filters 
    * @param offset 
    * @param recordLimit 
    * @param sortBy 
    * @param sortDirection 
    * @return List<Sobject> 
    **/
    @AuraEnabled
    public static List<Sobject> getData(String objectApiName, String fields, String filters, Integer offset, Integer recordLimit, String sortBy, String sortDirection) {
        System.debug(LoggingLevel.DEBUG, fields);
        System.debug(LoggingLevel.DEBUG, filters);

        List<Field> fieldArr = (List<Field>)JSON.deserialize(fields, List<Field>.class);
        List<Field> filterArr = (List<Field>)JSON.deserialize(filters, List<Field>.class);

        return getRecords(objectApiName, fieldArr, filterArr, offset, recordLimit, sortBy, sortDirection);
    }

    /**
    * @description 
    * @author Yi Zhang | 11/08/2020 
    * @param data 
    * @return Map<String, String>   key: object Id, value: error message 
    **/
    @AuraEnabled
    public static Map<String, String> updateData(List<SObject> data){
        try {
            Map<String, String> response = new Map<String, String>();
            System.debug(LoggingLevel.DEBUG, data);
            Database.SaveResult[] srList = Database.update(data, false);
            // workaround since SaveResult.getId() returns null for unsuccessful update
            for(Integer i = 0; i < data.size(); i++) {
                Database.SaveResult sr = srList[i];
                SObject record = data[i];
                System.debug(LoggingLevel.DEBUG, sr);
                if (sr.isSuccess() == false) {
                    List<String> errors = new List<String>();
                    for(Database.Error err : sr.getErrors()) {
                        errors.add(err.getMessage());
                    }
                    response.put((String)record.get('Id'), String.join(errors, '\n'));
                }
            }

            // update data;
            // return true;
            return response;
        } catch(Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    /**
    * @description 
    * @author Yi Zhang | 10/08/2020 
    * @param fields 
    * @return String 
    **/
    private static String fieldsToQueryFields(List<Field> fields) {
        List<String> fs = new List<String>{'Id'};
        for(Field f : fields) {
            if(String.isNotBlank(f.fieldName)) {
                fs.add(f.fieldName);
                if(f.isReference == true) {
                    // system lookup, e.g. ownerId, accountId
                    if(f.fieldName.endsWith('Id')) {
                        fs.add(f.fieldName.substring(0, f.fieldName.length() - 2) + '.Name');
                    }
                }
            }
        }
        return String.join(fs, ',');
    }

    /**
    * @description 
    * @author Yi Zhang | 10/08/2020 
    * @param filters 
    * @return String 
    **/
    private static String filtersToWhereClauses(List<Field> filters) {
        List<String> fs = new List<String>();
        for(Field f : filters) {
            if(String.isNotBlank(f.fieldName) && OPERATOR_MAP.containsKey(f.operator)) {

                if(OPERATOR_CONTAINS == f.operator) {
                    fs.add(f.fieldName + ' LIKE \'%' + f.value + '%\'');
                }
                else if (IGNORE_VALUE_OPERATORS.contains(f.operator)) {
                    fs.add(f.fieldName + ' ' + OPERATOR_MAP.get(f.operator));
                } else {
                    if(f.type == 'boolean' || f.type == 'currency' || f.type == 'date' || f.type == 'number') {
                        // boolean, currency or date, no quote
                        fs.add(f.fieldName + ' ' + OPERATOR_MAP.get(f.operator) + f.value);
                    } else if(f.type == 'picklist') {
                        // picklist, use IN
                        fs.add(f.fieldName + ' IN (\'' + f.value.replace(', ', '\', \'') + '\')');
                    } else {
                        fs.add(f.fieldName + ' ' + OPERATOR_MAP.get(f.operator) + ' \'' + f.value + '\'');
                    }
                }
            }
        }
        if(fs.size() > 0) {
            return ' WHERE ' + String.join(fs, ' AND ');
        }
        return '';
    }

    /**
    * @description  For lookup search
    * @author Yi Zhang | 10/08/2020 
    * @param searchTerm 
    * @param selectedIds 
    * @param searchObject 
    * @return List<LookupSearchResult> 
    **/
    @AuraEnabled(Cacheable=true)
    public static List<LookupSearchResult> search(String searchTerm, List<String> selectedIds, String searchObject) {
        // Prepare query paramters
        searchTerm += '%';  // SOQL uses %, SOSL uses *

        // Populate below map so that lookup search result has icon
        Map<String, String> knownObjectIconMap = new Map<String, String>{'Account'=>'standard:account', 'User'=>'standard:user'};
        String objIcon = knownObjectIconMap.get(searchObject);

        // Query
        List<SObject> searchResults = Database.query('SELECT Id, Name FROM ' + searchObject + ' WHERE Name LIKE :searchTerm LIMIT :MAX_RESULTS');

        // Prepare results
        List<LookupSearchResult> results = new List<LookupSearchResult>();

        // Extract Accounts & convert them into LookupSearchResult
        for(SObject so : searchResults) {
            results.add(
                new LookupSearchResult(
                    (Id)so.get('Id'),
                    searchObject,
                    objIcon,
                    (String)so.get('Name'),
                    ''
                )
            );
        }

        // Optionally sort all results on title
        results.sort();

        return results;
    }


    /**
    * @description  Add default filters
    * @author Yi Zhang | 10/08/2020 
    * @param response 
    * @param user 
    * @return CustomSearchWrapper 
    **/
    private static CustomSearchWrapper addDefaultFilters(CustomSearchWrapper response, User user) {
        response.defaultFilters = new List<Field>();
        // Example: add a record type filter for users of a particular country
        // if(user.Country__c == Constants.COUNTRY_AU) {
        //     Field f = new Field();
        //     f.label = 'Account Record Type';
        //     f.operator = 'equals';
        //     f.value = 'AU Customer';
        //     f.fieldName = 'RecordType.Name';
        //     f.isLocked = true;
        //     f.index = 10;
        //     response.defaultFilters.add(f);
        // } 

        return response;
    }

    /**
    * @description  To satisfy project specific requirements, not generic
    * @author Yi Zhang | 07/08/2020 
    * @param response 
    * @return CustomSearchWrapper 
    **/
    private static CustomSearchWrapper includeManualFields(CustomSearchWrapper response) {
        // Use this function to add fields which can't be configured through custom metadata type
        // Example: post code
        // Field postcodeField = new Field();
        // postcodeField.label = 'Postal Code';
        // postcodeField.fieldName = 'BillingPostalCode';
        // postcodeField.operators = 'equals';
        // postcodeField.isInput = true;
        // response.filterFields.add(postcodeField);
		
        return response;
    }

    /**
    * @description  To satisfy project specific requirements, not generic
    * @author Yi Zhang | 07/08/2020 
    * @param f 
    * @return Field 
    **/
    private static Field specialFieldOverride(Field f) {
        // Use this function to override properties of a field
        // Example: convert a particular field, convert from lookup to picklist
        // 
        // if(f.fieldName == 'Primary_Segment__c') {
        //     // override primary segment if record found
        //     List<AggregateResult> primaries = new List<AggregateResult>([SELECT Primary__c FROM Segment__c WHERE Primary__c != null GROUP BY Primary__c ORDER BY Primary__c ASC]);
        //     if(primaries.size() > 0) {
        //         f.isInput = false;
        //         f.isPicklist = true;
        //         f.picklistOptions = new List<Field>();
        //         for(AggregateResult ar : primaries) {
        //             Field plo = new Field();
        //             plo.label = (String)ar.get('Primary__c');
        //             plo.value = plo.label;
        //             plo.key = f.picklistOptions.size() + 1;
        //             f.picklistOptions.add(plo);
        //         }
        //     }
        // }
        return f;
    }

    private static Field setFieldType(String objectApiName, Field f) {
        Schema.DescribeFieldResult dfr = Schema.getGlobalDescribe().get(objectApiName).getDescribe().fields.getMap().get(f.fieldName).getDescribe();
        String type = String.valueOf(dfr.getType());
        if(type == 'Date') {
            f.type = 'date';
        } else if(type == 'Boolean') {
            f.type = 'boolean';
        } else if(type == 'Currency') {
            f.type = 'currency';
        } else if(type == 'Picklist') {
            f.type = 'picklist';
        } else if(type == 'Double') { 
            f.type = 'number';
        } else if(type == 'Reference') {
            if(f.fieldName.endsWithIgnoreCase('__c')) {
                f.fieldName = f.fieldName.substring(0, f.fieldName.length() - 1) + 'r.Name';
            }
        }
        return f;
    }

    /**
    * @description 
    * @author Yi Zhang | 07/08/2020 
    * @param objectApiName 
    * @param f 
    * @return Field 
    **/
    private static Field setFieldFlags(String objectApiName, Field f) {
        Schema.DescribeFieldResult dfr = Schema.getGlobalDescribe().get(objectApiName).getDescribe().fields.getMap().get(f.fieldName).getDescribe();
        String type = String.valueOf(dfr.getType());
        if(type == 'Date') {
            f.isDate = true;
        } else if(type == 'Boolean') {
            f.isBoolean = true;
        } else if(type == 'Reference') {
            f.isReference = true;
            f.referenceObj = String.valueOf(dfr.getReferenceTo()[0]);
        } else if(type == 'Picklist') {
            f.isPicklist = true;
            // populate picklist options
            f.picklistOptions = new List<Field>();
            for(Schema.PicklistEntry pe : dfr.getPicklistValues()) {
                Field plo = new Field();
                plo.label = pe.getLabel();
                plo.value = pe.getValue();
                plo.key = f.picklistOptions.size() + 1;
                f.picklistOptions.add(plo);
            }
        } else {
            f.isInput = true;
        }
        return f;
    }


    /**
     * @description
     */
    public class CustomSearchWrapper {
        @AuraEnabled
        public List<Field> displayFields;
        @AuraEnabled
        public List<Field> filterFields;
        @AuraEnabled
        public List<Field> defaultFilters;
        @AuraEnabled
        public List<Sobject> data;
        @AuraEnabled
        public String objectLabel;
        @AuraEnabled
        public String objectLabelPlural;
        @AuraEnabled
        public Integer queryLimit;
    }
    /**
     * @description
     */
    public class Field {
        @AuraEnabled
        public Integer key;         // used in multipicklist
        @AuraEnabled
        public Integer index;         // used in filter
        @AuraEnabled
        public String label;
        @AuraEnabled
        public String value;
        @AuraEnabled
        public String fieldName;
        @AuraEnabled
        public Boolean editable;
        @AuraEnabled
        public String type;
        @AuraEnabled
        public String operator;
        @AuraEnabled
        public String operators;
        @AuraEnabled
        public Boolean isDate;
        @auraEnabled
        public Boolean isPicklist;
        @auraEnabled
        public Boolean isBoolean;
        @auraEnabled
        public Boolean isInput;
        @auraEnabled
        public Boolean isReference;
        @AuraEnabled
        public String referenceObj;
        @AuraEnabled
        public Boolean isLocked;
        @AuraEnabled
        public List<Field> picklistOptions;
        @AuraEnabled
        public Boolean sortable;
        @AuraEnabled
        public Map<String, String> typeAttributes;
    }
}