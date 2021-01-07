import { LightningElement, track, api } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { loadStyle } from 'lightning/platformResourceLoader';
import { registerListener, unregisterAllListeners } from 'c/pubsub';
import { flattenJson } from 'c/util';
import userId from '@salesforce/user/Id';
import lwcCSS from '@salesforce/resourceUrl/lwcCSS';
import init from '@salesforce/apex/SM_CustomSearch.init';
import getData from '@salesforce/apex/SM_CustomSearch.getData';
import updateData from '@salesforce/apex/SM_CustomSearch.updateData';
import apexSearch from '@salesforce/apex/SM_CustomSearch.search';


const unsavedFilterClass = 'hasBeenEdited';
const newFilterFieldPlaceholder = "New Filter*";

export default class CustomSearch extends LightningElement {

    @api objectApiName = 'Account';

    @api objectLabel = 'Account';     
    @api objectLabelPlural = '';      
    @api queryLimit = 25;             // default set to 25, can be overriden by Apex

    @api cmpIconName = 'custom:custom47';

    @track filtersPaneOpen = true;
    @track columns = [];
    @track data = [];
    @track filters = [];
    @track savedFilters = [];           // to store filters upon pressing Save button      
    @track editFilterFlag = false;      // if true, will open the edit filter panel / dialog / component
    @track editFilterPanelStyle = "left: 320px; top: 320px; ";
    @track tableAndFiltersStyle = "height: 700px;";
    @track filterInEditing;
    @track filterFieldOptions = [];
    @track filterOperatorOptions = [];
    @track booleanOptions = [{label: 'True', value: 'True'}, {label: 'False', value: 'False'}];
    @track filterFields = [];           // store fields available for filtering, defined mainly in custom data
    @track filterMetaMap = new Map();   // store fields available for filtering, defined mainly in custom data
    @track fitlerMetaInEditing;         // the metadata of the field which filter is using
    @track hasUnsavedFiltersFlag = false;   // if true, show buttons on filter panel header

    @track rerenderValue = "";          // a random string to trigger rerendering of multipicklist
    @track initialised = false;
    @track loading = true;
    @track canLoadMore = true;          // when set to false, infinite loading stops
    @track sortBy;                      // the sorting field 
    @track sortDirection;               // the sorting direction

    get showFilterButtonVariant() { return this.filtersPaneOpen ? "brand" : "border-filled";}
    get picklistOptions() {return this.fitlerMetaInEditing.picklistOptions};
    get datatableLayoutSize() {return this.filtersPaneOpen ? "10":"12";}
    
    offsetTop = 0;
    offsetLeft = 0;

    connectedCallback() {
        // load css
        Promise.all([loadStyle(this, lwcCSS)]).then(() => {});
        // register listener
        registerListener('removeFilter', this.handleRemoveFilter, this);

        // initialisation
        if(this.initialised == false) {
            this.initialised = true;
            init({
                objectApiName : this.objectApiName,
                runningUserId : userId
            }).then(result => {
                console.log('results: ' + JSON.stringify(result));
                // populate properties
                this.objectLabel = (result.objectLabel) ? result.objectLabel : this.objectLabel;
                this.objectLabelPlural = (result.objectLabelPlural) ? result.objectLabelPlural : this.objectLabelPlural;
                this.queryLimit = result.queryLimit;
                // if first set of data is of the same size as queryLimit, then can load more
                this.canLoadMore = (this.queryLimit == result.data.length);
                this.columns = result.displayFields;
                this.filterFields = result.filterFields;
                this.filters = JSON.parse(JSON.stringify(result.defaultFilters));
                this.savedFilters = JSON.parse(JSON.stringify(this.filters));
                for(let ff of result.filterFields) {
                    this.filterMetaMap.set(ff.label, ff);
                }
                this.populateFilterFieldOptions(this.filterFields);
                this.data = this.prepareData(result.data);
                this.loading = false;
            }).catch(error => {
                console.log("error: " + JSON.stringify(error));
                if ( error.body && error.body.message) {
                    this.dispatchErrorEvent(error.body.message);
                }
                this.loading = false;
            })
        }
    }

    prepareData(data) {
        let outputData = [];
        for(let d of data) {
            outputData.push(flattenJson(d));
        }
        return outputData;
    }

    renderedCallback() {
        let offsetContainer = this.template.querySelector(".custom-search-full-height");
        if(offsetContainer) {
            let rect = offsetContainer.getBoundingClientRect();
            this.offsetLeft = rect.left;
            this.offsetTop  = rect.top;
        }

        let fullHeight = this.template.querySelector(".custom-search-full-height");
        // console.log(".custom-search-full-height: " + fullHeight.getBoundingClientRect().height);
        this.tableAndFiltersStyle = "height: " + (fullHeight.getBoundingClientRect().height - 54) + "px";
    }

    populateFilterFieldOptions(filterFields) {
        this.filterFieldOptions = [];
        for(let f of filterFields) {
            this.filterFieldOptions.push({label: f.label, value: f.label});
        }

        // sort by label
        this.filterFieldOptions.sort(function(a, b) {
            if(a.label > b.label) {
                return 1;
            } else {
                return -1;
            }
        });
    }

    populateFilterOperatorOptions(fieldLabel) {
        let fieldIndex = this.filterFields.findIndex(x => x.label == fieldLabel);
        // console.log('found filter field in this.filterFields with index: ' + fieldIndex);
        this.filterOperatorOptions = [];
        if(fieldIndex > -1) {
            let foundField = this.filterFields[fieldIndex];
            // console.log('found filter field in this.filterFields: ' + JSON.stringify(foundField));
            for(let val of foundField.operators.split(";")) {
                this.filterOperatorOptions.push({label: val, value: val});
            }
        }
        // console.log('latested operator options: ' + JSON.stringify(this.filterOperatorOptions));
    }


    toggleFiltersPane() {
        this.filtersPaneOpen = !this.filtersPaneOpen;
    }

    addFilter() {
        try {
            let newFilter = {label: newFilterFieldPlaceholder, operator: '', value: '', class: unsavedFilterClass, _lookupSelection: [], index: 10*(this.filters.length + 1)};
            this.filters.push(newFilter);
            
            this.updateHasUnsavedFiltersFlag();
        } catch(error) {
            console.log('error: ' + error);
        }
        

        let btn = this.template.querySelector("button[data-index='" + newFilter.index + "']");
        console.log(btn);
        btn.click();
        setTimeout(function() {
            // open the edit filter dialog / panel
            console.log(newFilter);
            try {
                    
            } catch(error) {
                console.log(error);
            }
        }, 500, this)

    }

    // open edit filter panel
    editFilter(event) {
        console.log('editFilter');
        console.log(JSON.stringify(event.currentTarget.dataset));
        let filterIndex = event.currentTarget.dataset.index;
        let foundIndex = this.filters.findIndex(x => x.index == filterIndex);
        this.filterInEditing = JSON.parse(JSON.stringify(this.filters[foundIndex]));
        // if the filterInEditing is locked, don't show the edit panel
        if(this.filterInEditing.isLocked == false || this.filterInEditing.isLocked == undefined) {
            this.editFilterFlag = true;
            try {
                // preselect field if not populated
                if(this.filterInEditing.label == newFilterFieldPlaceholder) {
                    this.filterInEditing.label = this.filterFieldOptions[0].value;
                }
                this.fitlerMetaInEditing = this.filterMetaMap.get(this.filterInEditing.label);
                console.log('this.fitlerMetaInEditing: ' + JSON.stringify(this.fitlerMetaInEditing));
                
                // merge filterMetaInEditing with filterInEditing
                this.filterInEditing = {
                    ...this.fitlerMetaInEditing,
                    ...this.filterInEditing
                };

                // populate operator options
                this.populateFilterOperatorOptions(this.filterInEditing.label);
                // preselect operator if not populated
                if(this.filterInEditing.operator == "") {
                    this.filterInEditing.operator = this.filterOperatorOptions[0].value;
                }
            } catch(e) {
                console.log(e);
            }
    
    
            let currentTarget = event.currentTarget;
            let rect = currentTarget.getBoundingClientRect();
            console.log('rect: ' + JSON.stringify(rect));
            this.editFilterPanelStyle = "top: " + (rect.y - this.offsetTop - 135) + "px; left: " + (rect.x - this.offsetLeft - 400 - 30) + "px;";
        }
    }

    handleFilterCancel(event) {
        this.editFilterFlag = false;
    }

    handleFilterDone(event) {
        this.editFilterFlag = false;
        console.log('start handleFilterDone');
        let filterIndex = event.target.value;
        // console.log('filterIndex: ' + filterIndex);
        try {
            // console.log('filterInEditing: ' + JSON.stringify(this.filterInEditing));
            let filterField = this.template.querySelector(".filterField");
            console.log('filterField: ' + filterField.value);
            let filterOperator = this.template.querySelector(".filterOperator");
            console.log('filterOperator: ' + filterOperator.value);
            let filterValue = this.template.querySelector(".filterValue");
            console.log('filterValue: ' + filterValue.value);

            
            let foundIndex = this.filters.findIndex(x => x.index == filterIndex);
            let foundFilter = this.filterInEditing;
            // inputs changed, mark as unsaved
            foundFilter.class = (foundFilter.label != filterField.value || foundFilter.operator != filterOperator.value || foundFilter.value != filterValue.value) ? unsavedFilterClass : foundFilter.class;
            foundFilter.label = filterField.value;
            foundFilter.operator = filterOperator.value;
            foundFilter.value = filterValue.value;
            foundFilter._lookupSelection = [];
            // in case it's a lookup, tweak a bit
            if(filterValue.value && filterValue.value.id) {
                foundFilter._lookupSelection = filterValue.value;
                foundFilter.value = filterValue.value.title;
            }
            // input empty, mark as unsaved ???
            if(foundFilter.class == "" && foundFilter.value == newFilterFieldPlaceholder) {
                foundFilter.class = unsavedFilterClass;
            }
            // populate some flag properties
            // console.log('this.fitlerMetaInEditing: ' + JSON.stringify(this.fitlerMetaInEditing));
            foundFilter.isDate = (this.fitlerMetaInEditing && this.fitlerMetaInEditing.isDate == true);
            // console.log('foundFilter.isDate: ' + foundFilter.isDate);
            foundFilter.fieldName = this.fitlerMetaInEditing.fieldName;

            this.filters[foundIndex] = foundFilter;

            this.updateHasUnsavedFiltersFlag();
        } catch(e) {
            console.log('handleFilterDone error: ' + e);
        }

        console.log('end handleFilterDone');
    }

    updateHasUnsavedFiltersFlag() {
        
        this.hasUnsavedFiltersFlag = false;

        // compare the filters with savedFilters
        this.hasUnsavedFiltersFlag = (JSON.stringify(this.filters) != JSON.stringify(this.savedFilters));
        // go through the filters
        // for(let f of this.filters) {
        //     // console.log('checking for ' + unsavedFilterClass + ' in ' + JSON.stringify(f));
        //     if(f.class == unsavedFilterClass) {
        //         this.hasUnsavedFiltersFlag = true;
        //         return;
        //     }
        // }
    }


    handleFilterFieldChange(event) {
        console.log('handleFilterFieldChange start');
        try {
            // trigger the multipicklist to rerender (if changing from multi to multi)
            this.rerenderValue = Math.random();
            // trigger the operator to change
            let fieldLabel = event.target.value;
            console.log('selected field: '+ fieldLabel);
            this.populateFilterOperatorOptions(fieldLabel);
            this.fitlerMetaInEditing = this.filterMetaMap.get(fieldLabel);
            // merge filterMetaInEditing with filterInEditing
            this.filterInEditing = {
                ...{label: newFilterFieldPlaceholder, operator: '', value: '', class: unsavedFilterClass, _lookupSelection: [], index: this.filterInEditing.index},
                ...this.fitlerMetaInEditing
            };
            console.log('fitlerMetaInEditing: ' + JSON.stringify(this.fitlerMetaInEditing));
            // clear the value
            this.filterInEditing.value = '';
            // in case filterInEditing.operator not in the list, use the first one
            for(let o of this.filterOperatorOptions) {
                if(o.value == this.filterInEditing.operator) {
                    return;
                }
            }
            this.filterInEditing.operator = this.filterOperatorOptions[0].value;
        } catch(e) {
            console.log('handleFilterFieldChange Error: ' + e);
        }
        console.log('handleFilterFieldChange end');
    }

    handleFilterOperatorChange() {
    }

    handleFilterValueChange() {
    }

    handleOnItemSelected(event) {
        if (event.detail) {
            
            event.detail.forEach (function (eachItem) {
                    console.log ('msselected: ' + eachItem.value);
            });
        }
    }


    removeAllFilters() {
        // the locked filters remains
        let lockedFilters = [];
        for(let f of this.filters) {
            if(f.isLocked == true) {
                lockedFilters.push(f);
            }
        }
        this.filters = lockedFilters;
        
        this.updateHasUnsavedFiltersFlag();
        
    }

    removeFilter(event) {
        let filterIndex = event.target.value;

        let foundIndex = this.filters.findIndex(x => x.index == filterIndex);
        if(foundIndex > -1) {
            this.filters.splice(foundIndex, 1);
            this.updateHasUnsavedFiltersFlag();
            console.log('Success: removed filter with index ' + filterIndex);
            this.hasUnsavedFiltersFlag = true;
        } else {
            console.log('Error: failed to find the filter');
        }

        // this.handleRemoveFilter({index: filterIndex});
    }

    removeUnsavedFilters() {
        // get filters from savedFilters
        this.filters = JSON.parse(JSON.stringify(this.savedFilters));
        this.hasUnsavedFiltersFlag = false;
        this.editFilterFlag = false;
    }

    saveUnsavedFilters() {
        // store filters to savedFilters
        this.savedFilters = JSON.parse(JSON.stringify(this.filters));
        this.hasUnsavedFiltersFlag = false;
        this.editFilterFlag = false;

        this.loading = true;

        let refinedFilters = this.refineFiltersForQuery(this.filters);

        console.log('fields: ' + JSON.stringify(this.columns));
        console.log('filters: ' + JSON.stringify(refinedFilters));
        getData({
            objectApiName: this.objectApiName,
            fields: JSON.stringify(this.columns),
            filters: JSON.stringify(refinedFilters),
            offset: 0,
            recordLimit: this.queryLimit,
            sortBy: this.sortBy,
            sortDirection: this.sortDirection
        }).then(result => {
            console.log(result);
            this.data = this.prepareData(result);
            this.loading = false;
            // this.canLoadMore = true;    // reset to true when new filters applied for the first time
            this.canLoadMore = (this.queryLimit == result.length);

            // remove datatable's draftValues
            let dt = this.template.querySelector(".datatable");
            dt.draftValues = [];
            
            // mark all filters' class as ''
            for(let f of this.filters) {
                f.class = '';
            }

            this.dispatchSuccessEvent("List view updated.");
        }).catch(error => {
            console.log('error: ' + JSON.stringify(error));
            this.dispatchErrorEvent('Filters could not be applied. Please check your filters.');
            this.loading = false;
        })
    }

    refineFiltersForQuery(filters) {
        let refinedFilters = [];
        try {
            for(let f of filters) {
                let fc = JSON.parse(JSON.stringify(f));
                // reference / lookup field
                if(fc.isReference == true) {
                    fc.value = fc._lookupSelection.id;
                    fc.fieldName = fc.fieldName.replace('__r.Name', '__c');
                }
                // picklist
                if(fc.isPicklist == true) {
                    // translate from label to value
                    let labels = fc.value.split(', ');
                    let values = [];
                    for(let o of fc.picklistOptions) {
                        for(let l of labels) {
                            if(o.label == l) {
                                values.push(o.value);
                            }
                        }
                    }
                    fc.value = values.join(', ');
                }
                refinedFilters.push(fc);
            }
        } catch(err) {
            console.log('refineFiltersForQuery error: ' + err);
        }
        return refinedFilters;
    }
    
    // handleRemoveFilter(filter) {
    //     // find the filter of the same index and remove it from the list
    //     let foundIndex = this.filters.findIndex(x => x.index == filter.index);
    //     if(foundIndex > -1) {
    //         this.filters.splice(foundIndex, 1);
    //         console.log('Success: removed filter with index ' + filter.index);
    //     } else {
    //         console.log('Error: failed to find the filter');
    //     }
    // }

    // lookup search
    handleSearch(event) {
        const target = event.target;
        console.log('event.detail: ' + JSON.stringify(event.detail));
        apexSearch(event.detail)
            .then(results => {
                target.setSearchResults(results);
            })
            .catch(error => {
                // TODO: handle error
            });
    }

    handleDataTableSort(event) {
        this.sortBy = event.detail.fieldName;
        this.sortDirection = event.detail.sortDirection;
        console.log(JSON.stringify(event.detail));
        this.saveUnsavedFilters();
    }

    handleDataTableSave(event) {
        console.log('handleDataTableSave start');
        // let changes = JSON.parse(JSON.stringify(event.detail.draftValues));
        console.log(event.detail.draftValues);
        if(event.detail.draftValues != undefined) {
            console.log('sending to backend');
            this.loading = true;
            updateData({
                data : event.detail.draftValues
            }).then(result => {
                console.log('result: ');
                console.log(result);

                let dt = this.template.querySelector(".datatable");

                // all updated successfully
                // if(Object.keys(result).length == 0) {
                //     // merge changes (draftValues) with data
                //     for(let change of dt.draftValues) {
                //         let foundIndex = this.data.findIndex(x => x.Id == change.Id);
                //         if(foundIndex > -1) {
                //             this.data[foundIndex] = {
                //                 ...this.data[foundIndex],
                //                 ...change
                //             }
                //         }
                //     }
                //     dt.draftValues = [];
                //     this.dispatchSuccessEvent('Updated successfully');
                // } else {
                // partial update
                // build error message
                let errorMessage = "";
                // for (const [key, value] of Object.entries(result)) {

                //     errorMessage += "Account Name: "+key+"\nErrors:\n"+value+"\n";
                // }
                // reduce draftValues
                let newDraftValues = [];
                for(let change of dt.draftValues) {
                    // find the data
                    let foundIndex = this.data.findIndex(x => x.Id == change.Id);
                    // merge only when change didn't come back with error
                    if(foundIndex > -1) {
                        if(!(change.Id in result)) {
                            this.data[foundIndex] = {
                                ...this.data[foundIndex],
                                ...change
                            };
                            // don't add to newDraftValues
                        } else {
                            // add to newDraftValues
                            newDraftValues.push(change);
                            errorMessage += "\nAccount Name: "+ this.data[foundIndex].Name +"\nErrors:\n"+ result[change.Id] +"\n";
                        }
                    } 
                }
                dt.draftValues = newDraftValues;
                if(errorMessage != "") {
                    this.dispatchErrorEvent(errorMessage, 'sticky');
                } else {
                    this.dispatchSuccessEvent('Your changes are saved.');
                }
                // }
                // console.log('updated successfully');
                this.loading = false;
            }).catch(error => {
                console.log("error: " + JSON.stringify(error));
                if ( error.body && error.body.message) {
                    this.dispatchErrorEvent(error.body.message);
                }
                this.loading = false;
            })
            // for(let change of changes) {
            //     let index = change.Id.replace("row-", "");
            //     change.Id = index;
            //     console.log('index: ' + index);
            //     // replace Id field with Id of this.data
            //     // console.log(JSON.stringify(this.data[index]));
            //     // change.Id = this.data[index].Id;
            // }
            // console.log('changes: ' + JSON.stringify(changes));
        }
        // let dt = this.template.querySelector(".datatable");
        // console.log(JSON.stringify(dt.getSelectedRows()));
    }

    handleDataTableLoadMore(event) {

        if(this.canLoadMore == false) {
            console.log('cannot load more');
        } else {
            if(event.target.isLoading == false) {
    
                event.target.isLoading = true;
                let target = event.target;
                // fetch more
                getData({
                    objectApiName: this.objectApiName,
                    fields: JSON.stringify(this.columns),
                    filters: JSON.stringify(this.refineFiltersForQuery(this.filters)),
                    offset: this.data.length,
                    recordLimit: this.queryLimit,
                    sortBy: this.sortBy,
                    sortDirection: this.sortDirection
                }).then(result => {
                    console.log(result);
                    if(result.length == 0) {
                        this.canLoadMore = false;
                        console.log('canLoadMore set to false');
                    }
                    this.data = this.data.concat(this.prepareData(result));
                    
                    target.isLoading = false;
                }).catch(error => {
                    console.log('error: ' + JSON.stringify(error));
                    if ( error.body && error.body.message) {
                        this.dispatchErrorEvent(error.body.message);
                    }
                    target.isLoading = false;
                })
            } else {
                console.log('already loading, please be patient');
            }
        }
    }


    // dispatch events
    dispatchSuccessEvent(msg) {
        this.dispatchEvent(new ShowToastEvent({
            title: 'Success',
            variant : 'success',
            message: msg
        }));
    }

    dispatchErrorEvent(msg, mode) {
        if(typeof mode == 'undefined') {
            mode = 'dismissable';
        }
        this.dispatchEvent(new ShowToastEvent({
            title: 'Error',
            variant : 'error',
            message: msg,
            mode: mode
        }));
    }

    dispatchWarningEvent(msg) {
        this.dispatchEvent(new ShowToastEvent({
            title: 'Warning',
            variant : 'warning',
            message: msg
        }));
    }
}