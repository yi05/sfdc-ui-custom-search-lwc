import {LightningElement, api, track} from 'lwc';
export default class MultiPickList extends LightningElement {

    @api label  = ''; //Name of the dropDown
    @api maxselected  = 2; //Max selected item display
    @api options; // List of items to display
    @api showfilterinput = false; //show filterbutton
    @api showrefreshbutton = false; //show the refresh button
    @api showclearbutton = false; //show the clear button
    @api comboplaceholder = 'Select a value'; 
    @api rerenderValue = ""; // if this one changes, the LWC rerenders

    // value getter / setter (align with standard component)
    @api get value() {
        let returnArr = [];
        for(let si of this.getSelectedItems()) {
            returnArr.push(si.label);
        }
        return returnArr.join(', ');
    }
    set value(val) {
        this._value = val;
        // console.log('_value set to ' + this._value);
    }
    
    @track _initializationCompleted = false;
    @track _selectedItems = 'Select a value';
    @track _filterValue;
    @track _mOptions;
    @track _value;

    constructor () {
        super();
        this._filterValue = '';
        //this.showfilterinput = true;
        //this.showrefreshbutton = true;
        //this.showclearbutton = true;
    }
    renderedCallback () {
        let self = this;
        console.log('this.options ' + JSON.stringify(this.options));
        console.log('this._mOptions ' + JSON.stringify(this._mOptions));
        if (!this._initializationCompleted) {
            this.template.querySelector ('.ms-input').addEventListener ('click', function (event) {
                console.log ('multipicklist clicked');
                self.onDropDownClick(event.target);
                event.stopPropagation ();
            });
            this.template.addEventListener ('click', function (event) {
                console.log ('multipicklist-1 clicked');
                event.stopPropagation ();
            });
            document.addEventListener ('click', function (event) {
                console.log ('document clicked');
                self.closeAllDropDown();
            });
            this._initializationCompleted = true;
            
            // based on the value, set the options' selected
            // console.log('this._value: ' + this._value);
            if(this._value != undefined && this._value != null) {
                for(let selectedVal of this._value.split(',')) {
                    selectedVal = selectedVal.trim();
                    // console.log('selected Val: ' + selectedVal);
                    for(let option of this._mOptions) {
                        // console.log('option.label: ' + option.label);
                        if(option.label == selectedVal) {
                            option.selected = true;
                        }
                    }
                }
            }
            // end of setting options' selected attribute
            
            this.setPickListName ();
        }
        
        this.renderListWithValue();
        console.log('multipicklist rendered Callback');
    }

    renderListWithValue() {
        let optionsStr  = JSON.stringify(this.options.map(a => a.label));
        let mOptionsStr = JSON.stringify(this._mOptions.map(a => a.label));
        console.log('this.options label ' + optionsStr);
        console.log('this._mOptions label ' + mOptionsStr);

        // copy options to _mOptions if not the same
        // then populate picklist
        if(optionsStr != mOptionsStr) {
            this.initArray(this);
            this.setPickListName();
        }
    }

    handleItemSelected (event) {
        let self = this;
        this._mOptions.forEach (function (eachItem) {
            if (eachItem.key == event.detail.item.key) {
                eachItem.selected = event.detail.selected;
                return;
            }
        });
        this.setPickListName ();
        this.onItemSelected ();
    }
    filterDropDownValues (event) {
        this._filterValue = event.target.value;
        this.updateListItems (this._filterValue);
    }
    closeAllDropDown () {
        Array.from (this.template.querySelectorAll ('.ms-picklist-dropdown')).forEach (function (node) {
             node.classList.remove('slds-is-open');
        });
    }

    onDropDownClick (dropDownDiv) {
        let classList = Array.from (this.template.querySelectorAll ('.ms-picklist-dropdown'));
        if(!classList.includes("slds-is-open")){
            this.closeAllDropDown();
            Array.from (this.template.querySelectorAll ('.ms-picklist-dropdown')).forEach (function (node) {
                node.classList.add('slds-is-open');
            });
        } else {
            this.closeAllDropDown();
        }
    }
    onRefreshClick (event) {
        this._filterValue = '';
        this.initArray (this);
        this.updateListItems ('');
        this.onItemSelected ();
    }
    onClearClick (event) {
        this._filterValue = '';
        this.updateListItems ('');
    }
    connectedCallback () {  
        this.initArray (this);
    }
    initArray (context) {
        context._mOptions = new Array ();  
        context.options.forEach (function (eachItem) {
            context._mOptions.push (JSON.parse (JSON.stringify(eachItem)));
        });
    }
    updateListItems (inputText) {
        Array.from (this.template.querySelectorAll('c-pick-list-item')).forEach (function (node) {
            if(!inputText){
                node.style.display = "block";
            } else if(node.item.value.toString().toLowerCase().indexOf(inputText.toString().trim().toLowerCase()) != -1){
                node.style.display = "block";
            } else{
                node.style.display = "none";
            }
        });
        this.setPickListName ();
    }
    setPickListName () {
        let selecedItems = this.getSelectedItems ();
        let selections = [];
        if (selecedItems.length < 1) {
            selections.push(this.comboplaceholder);
        } else if (selecedItems.length > this.maxselected) {
            selections.push(selecedItems.length + ' Options Selected');
        } else {
            selecedItems.forEach (option => {
                selections.push(option.value);
            });
        }
        this._selectedItems = selections.join(', ');
    }
    @api
    getSelectedItems () {
        let resArray = new Array ();
        this._mOptions.forEach (function (eachItem) {
            if (eachItem.selected) {
                resArray.push (eachItem);
            }
        });
        return resArray;
    }

    onItemSelected () {
        const evt = new CustomEvent ('itemselected', { detail : this.getSelectedItems ()});
        this.dispatchEvent (evt);
    }


}