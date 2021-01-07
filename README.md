# Custom List View
- This is based on requirements from a client

## Client Requirements
- Want certain users access a common list view
- List view has the same columns configured by Sys Admin
- List view has same filter fields and operators configured by Sys Admin
- Users of certain profile(s) can inline edit certain fields
- Users can apply filters and not affecting others view
- Users can bulk inline edit fields (which has limitation on OOTB list view)
- The list view is stateless

## Post Installation Steps
- Add Permission Set Custom Search PS to user who needs access to custom search.
- The project comes with two flexi pages, Account Advanced Search & Contact Advanced Search, use them as the starting point.

## Permission Set - Custom Search PS
- contains access to apex classes

## Custom Metadata Type - Custom_Search_Field__mdt
- Stores all the configurations controlled by Sys Admin, including what fields to read/edit/filter.

## LWC - Custom Search
- Configurations: Sobject, Label, Icon


## References
- Lookup component from https://github.com/pozil/sfdc-ui-lookup-lwc
- multiPickList component from 
