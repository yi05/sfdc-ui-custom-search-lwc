/*******************************************************************************************************
* Class Name      	: DM_CustomSearchField
* Description		: Data Layer - Selector for CMT Custom_Search_Field__mdt
* Author          	: Simplus - Yi Zhang
* Created On      	: 31/07/2020
* Modification Log	:
* -----------------------------------------------------------------------------------------------------
* Developer				Date			Modification ID		Description
* -----------------------------------------------------------------------------------------------------
* Yi Zhang              31/07/2020		1000				Initial version
******************************************************************************************************/
public class DM_CustomSearchField {

    /**
    * @description 
    * @author Yi Zhang | 31/07/2020 
    * @param objectApiName 
    * @return List<Custom_Search_Field__mdt> 
    **/
    public static List<Custom_Search_Field__mdt> customSearchFieldDataByObject(String objectApiName) {
        return new List<Custom_Search_Field__mdt>([
            SELECT Id,
            Object__r.QualifiedApiName, 
            Field__r.QualifiedApiName, 
            Field__r.Label, 
            Display_Field__c, Filter_Field__c, Editable__c, Editable_By__c, Display_Order__c, Operators__c
            FROM Custom_Search_Field__mdt
            WHERE Object__r.QualifiedApiName = :objectApiName
            ORDER BY Display_Order__c ASC
        ]);
    }
}