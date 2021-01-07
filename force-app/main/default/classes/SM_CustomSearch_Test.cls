/*******************************************************************************************************
* Class Name      	: SM_CustomSearch_Test
* Description		: Test class for SM_CustomSearch
* Author          	: Simplus - Yi Zhang
* Created On      	: 16/08/2020
* Modification Log	:
* -----------------------------------------------------------------------------------------------------
* Developer				Date			Modification ID		Description
* -----------------------------------------------------------------------------------------------------
* Yi Zhang              16/08/2020		1000				Initial version
******************************************************************************************************/
@isTest
private class SM_CustomSearch_Test {
    @isTest
    private static void test_init() {

        List<Account> accounts = new List<Account>{new Account(Name = 'Test 1'), new Account(Name = 'Test 2')}; // TestDataFactory.createAccounts(10);
        insert accounts;
        // Operations_Region__c o = new Operations_Region__c(Name = 'NSW');
        // insert o;

        Test.startTest();
        SM_CustomSearch.CustomSearchWrapper response = SM_CustomSearch.init('Account', UserInfo.getUserId());
        
        List<Account> data = SM_CustomSearch.getData('Account', JSON.serialize(response.displayFields), JSON.serialize(response.filterFields), 0, 25, null, null);
        System.assertEquals(2, data.size(), 'Data not retrieved as expected');

        List<LookupSearchResult> results = SM_CustomSearch.search('TestCompany1', new List<String>(), 'Account');

        Account a = accounts[0];
        // a.Do_Not_Call__c = true;
        a.Name = 'Test 11111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111' + 
            '1111111111111111111111111111111111111111111111111111111111111111111' + 
            '1111111111111111111111111111111111111111111111111111111111111111111' + 
            '1111111111111111111111111111111111111111111111111111111111111111111' + 
            '1111111111111111111111111111111111111111111111111111111111111111111' + 
            '1111111111111111111111111111111111111111111111111111111111111111111';
        Map<String, String> updateResult = SM_CustomSearch.updateData(new List<Account>{a, accounts[1]});
        System.debug('updateResult: ' + JSON.serialize(updateResult));
        System.assertEquals(1, updateResult.size(), 'Data not updated as expected');

        Test.stopTest();
    }
}