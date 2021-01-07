const recalculateItem = (item, fieldName, fieldValue) => {
    // console.log('util recalculateItem starts');
    let result = {
        under10GPUpdate: 0,
        lowerGPthanPreviousUpdate: 0
    };
    let forecast = {
        totalCurrentContractSalesUpdate: 0,
        totalCurrentCOGSUpdate: 0,
        totalProjectedSalesUpdate: 0,
        totalProjectedCOGSUpdate: 0
    };
    let newItem = {Id: item.Id};
    newItem[fieldName] = fieldValue;
    newItem.Name = item.Name;

    let itemToSave = {Id: item.Id};
    /**
     * Margin / Sell Price / Sell Mvmt Percent
     */
    // console.log('checkpoint 0');
    if(fieldName.startsWith("Margin_") || fieldName.startsWith("Price_") || fieldName.startsWith('Sell_Movement_')) {
        let marginFieldName, priceFieldName, mvmtPercentFieldName, previousPriceFieldName;    
        if(fieldName.startsWith("Margin_")) {
            // Margin to work out sell price
            marginFieldName = fieldName;
            priceFieldName = fieldName.replace('Margin_', 'Price_');

            newItem[priceFieldName] = (100 * item[fieldName.replace('Margin_', 'Cost_')]) / (100 - fieldValue);
            newItem[priceFieldName] = isNaN(newItem[priceFieldName]) ? "" : newItem[priceFieldName].toFixed(2);

        } else if(fieldName.startsWith("Price_")) {
            // Sell price to work out Margin
            priceFieldName = fieldName;
            marginFieldName = fieldName.replace('Price_', 'Margin_');
            
            newItem[marginFieldName] = 100 * (fieldValue - item[fieldName.replace('Price_', 'Cost_')]) / fieldValue;
            newItem[marginFieldName] = isNaN(newItem[marginFieldName]) ? "" : newItem[marginFieldName].toFixed(2);

        } else if(fieldName.startsWith('Sell_Movement_')) {
            // Sell Movement Percent to Price then margin (skipped Sell Movement $ as it's not included in fields to be displayed)
            mvmtPercentFieldName = fieldName;
            priceFieldName = fieldName.replace('Sell_Movement_Percentage_', 'Price_');
            previousPriceFieldName = "Previous_" + priceFieldName;
            marginFieldName = fieldName.replace("Sell_Movement_Percentage_", "Margin_");
            
            newItem[priceFieldName] = item[previousPriceFieldName] * (1 + fieldValue / 100);
            newItem[priceFieldName] = isNaN(newItem[priceFieldName]) ? "" : newItem[priceFieldName].toFixed(2);
            newItem[marginFieldName] =  100 * (newItem[priceFieldName] - item[fieldName.replace('Sell_Movement_Percentage_', 'Cost_')]) / newItem[priceFieldName];
            newItem[marginFieldName] = isNaN(newItem[marginFieldName]) ? "" : newItem[marginFieldName].toFixed(2);
        }

        // Special Buy Margin
        let sbMarginFieldName = priceFieldName.replace("Price_", "Margin_Spec_Buy_");
        newItem[sbMarginFieldName] = 100 * (newItem[priceFieldName] - item["Special_Buy_Item__r.Cost__c"]) / newItem[priceFieldName];
        newItem[sbMarginFieldName] = isNaN(newItem[sbMarginFieldName]) ? '' : newItem[sbMarginFieldName].toFixed(2);

        // Retail Margin
        // item["Retail_Margin_" + zone + "__c"] = 100 * (item["Retail_Price_" + zone + "__c"] - item["Cost_" + zone + "__c"]) / item["Price_" + zone + "__c"];
        // item["Retail_Margin_" + zone + "__c"] = isNaN(item["Retail_Margin_" + zone + "__c"]) ? '' : item["Retail_Margin_" + zone + "__c"].toFixed(2);
        let retailMarginFieldName = priceFieldName.replace("Price_", "Retail_Margin_");
        let retailPriceFieldName = priceFieldName.replace("Price_", "Retail_Price_");
        let costFieldName = priceFieldName.replace("Price_", "Cost_");
        newItem[retailMarginFieldName] = 100 * (item[retailPriceFieldName] - item[costFieldName]) / newItem[priceFieldName];
        newItem[retailMarginFieldName] = isNaN(newItem[retailMarginFieldName]) ? '' : newItem[retailMarginFieldName].toFixed(2);
        

        // Movements
        let mvmtFieldName = priceFieldName.replace("Price_", "Sell_Movement_");
        // Specific for Margin & Sell
        if(fieldName.startsWith("Sell_Movement_") == false) {
            mvmtPercentFieldName = priceFieldName.replace("Price_", "Sell_Movement_Percentage_");
            previousPriceFieldName = priceFieldName.replace("Price_", "Previous_Price_");
            newItem[mvmtFieldName] = newItem[priceFieldName] - item[previousPriceFieldName];
            newItem[mvmtPercentFieldName] = 100 * newItem[mvmtFieldName] / item[previousPriceFieldName];
            newItem[mvmtPercentFieldName] = isNaN(newItem[mvmtPercentFieldName]) ? '' : newItem[mvmtPercentFieldName].toFixed(2);
            newItem[mvmtFieldName] = isNaN(newItem[mvmtFieldName]) ? '' : newItem[mvmtFieldName].toFixed(2);    
        }
        
        // Forecast
        let qtyField = priceFieldName.replace('Price_', 'Previous_Sales_Qty_');
        let oldSum = item[priceFieldName] * item[qtyField];
        let newSum = fieldValue * item[qtyField];
        forecast.totalProjectedSalesUpdate = (isNaN(newSum) ? 0 : newSum) - (isNaN(oldSum) ? 0 : oldSum);

        // merge item for alert flags
        result.item = {
            ...item,
            ...newItem
        };

        // for item to be saved (just the delta value)
        itemToSave[priceFieldName] = newItem[priceFieldName];
        itemToSave[marginFieldName] = newItem[marginFieldName];
    }
    // console.log('checkpoint 1');
    /**
     * Enabled
     */
    else if(fieldName == 'Enabled__c') {
        if(item.hasOwnProperty(fieldName) == false) {
            item[fieldName] = false;
        }
        // actual value
        newItem[fieldName] = item[fieldName] ? false : true;
        // value for filter
        newItem["Remove_Item__c"] = !newItem[fieldName];

        // work out the delta of forecast
        for(let zone of item.costZones) {
            if(item["Previous_Sales_" + zone + "__c"] != undefined) 
                forecast.totalCurrentContractSalesUpdate += item["Previous_Sales_" + zone + "__c"];
            if(item["Previous_COGS_" + zone + "__c"] != undefined)
                forecast.totalCurrentCOGSUpdate += item["Previous_COGS_" + zone + "__c"];
            if(item["Previous_Sales_Qty_" + zone + "__c"] != undefined) {
                if(item["Price_" + zone + "__c"] != undefined)
                    forecast.totalProjectedSalesUpdate += (item["Previous_Sales_Qty_" + zone + "__c"] * item["Price_" + zone + "__c"]);
                if(item["Cost_" + zone + "__c"] != undefined)
                    forecast.totalProjectedCOGSUpdate += (item["Previous_Sales_Qty_" + zone + "__c"] * item["Cost_" + zone + "__c"]);
            }  
        }

        if(newItem[fieldName] == true) {
            // console.log('changing from ticked to unticked');
            // add
        } else {
            // console.log('changing from unticked to ticked');
            // subtract
            forecast.totalCurrentContractSalesUpdate *=-1;
            forecast.totalCurrentCOGSUpdate *= -1;
            forecast.totalProjectedSalesUpdate *= -1;
            forecast.totalProjectedCOGSUpdate *= -1;
        }

        result.item = {
            ...item,
            ...newItem
        };

        // for item to be saved (just the delta value)
        itemToSave[fieldName] = newItem[fieldName];
    }
    /**
     * All other scenarios
     */
    else {
        result.item = {
            ...item,
            ...newItem
        };
        
        // for item to be saved (just the delta value)
        itemToSave[fieldName] = newItem[fieldName];
    }

    // console.log('fieldName: ' + fieldName);
    // console.log('checkpoint 2');
    // console.log('result.item:' + JSON.stringify(result.item));
    /**
     * Alert flags
     */
    // calculate the alert flags, must look at all margins
    result.item["under10GP"] = false;
    result.item["lowerGPthanPrevious"] = false;
    // console.log('item.underGPPercent: ' + item.underGPPercent);
    // console.log('item.contractType: ' + item.contractType);
    if(result.item.Enabled__c == true && fieldName != 'Start_Date__c') {
        // CCRM-111 / 5899 / 5990 All 3 contract types
        if(item.contractType == 'New' || item.contractType == 'Renewal' || item.contractType == 'Amendment') {
            for(let zone of item.costZones) {
                let marginField = "Margin_" + zone + "__c";
                // console.log('result.item[' + marginField + ']: ' + result.item[marginField]);
                if(result.item.hasOwnProperty(marginField) == false || result.item[marginField] < item.underGPPercent) {
                    result.item["under10GP"] = result.item["under10GP"] || true;
                } 
            }
        }
        // CCRM-5899
        if(item.contractType == 'Renewal') {
            for(let zone of item.costZones) {
                let marginField = "Margin_" + zone + "__c";
                let previousMarginField = "Previous_Margin_" + zone + "__c";
                if(result.item[marginField]*1 < result.item[previousMarginField]*1) {
                    result.item["lowerGPthanPrevious"] = result.item["lowerGPthanPrevious"] || true;
                }
            }
        }
    }
    // Work out the figures to be sent in events
    if(item["under10GP"] == false && result.item["under10GP"] == true) {
        result.under10GPUpdate = 1;
    } else if(item["under10GP"] == true && result.item["under10GP"] == false) {
        result.under10GPUpdate = -1;
    }

    if(item["lowerGPthanPrevious"] == false && result.item["lowerGPthanPrevious"] == true) {
        result.lowerGPthanPreviousUpdate = 1;
    } else if(item["lowerGPthanPrevious"] == true && result.item["lowerGPthanPrevious"] == false) {
        result.lowerGPthanPreviousUpdate = -1;
    }
    

    // console.log('checkpoint 3');
    
    result.updatedItem = newItem;
    result.forecast = forecast;
    result.itemToSave = itemToSave;

    // console.log('result: ' + JSON.stringify(result));
    // console.log('util recalculateItem ends');
    return result;
}

const formatComments = (obj, flattened) => {
    // workout comments
    obj = {
        ...{
            Approver_Comments__c: '',
            Approver_Action_Date__c: '',
            Approver_Action__c: '',
            Approver__r: {Name: ''},
            Reviewer_Comments__c: '',
            Reviewer_Action_Date__c: '',
            Reviewer_Action__c: '',
            Reviewer__r: {Name: ''},
        },
        ...obj
    };
    // console.log('formatComments obj: ' + JSON.stringify(obj));
    // Approver_Action__c / Reviewer_Action__c reformatting
    if(obj.Approver_Action__c == 'A') {
        obj.Approver_Action__c = 'Approved';
    } else if(obj.Approver_Action__c == 'R') {
        obj.Approver_Action__c = 'Rejected';
    }
    if(obj.Reviewer_Action__c == 'A') {
        obj.Reviewer_Action__c = 'Approved';
    } else if(obj.Reviewer_Action__c == 'R') {
        obj.Reviewer_Action__c = 'Rejected';
    }

    let comments = [];
    // each comment is like {date: '2020-09-02T02:13:55.000Z', details: '02/09/2020 12:12 PM | AU ASM 2 TestUser (Rejected): Approver rejected because...'}
    if(obj.Reviewer_Comments__c != undefined && obj.Reviewer_Comments__c != '') {
        let actionDateTime = '';
        if(obj.Reviewer_Action_Date__c != undefined && obj.Reviewer_Action_Date__c != '') {
            try {
                actionDateTime = (new Date(obj.Reviewer_Action_Date__c)).toLocaleString('en-AU').toUpperCase().replace(",", "");
            } catch (error) {
                console.log('unable to convert to locale date time string for obj.Reviewer_Action_Date__c ' + error);
            }
        }
        comments.push({
            date: obj.Reviewer_Action_Date__c,
            details: actionDateTime + ' | ' + obj["Reviewer__r.Name"] + ' ('   //.split("-").reverse().join("/")
            + obj.Reviewer_Action__c + '): ' + obj.Reviewer_Comments__c
        });
    }
    if(obj.Approver_Comments__c != undefined && obj.Approver_Comments__c != '') {
        let actionDateTime = '';
        if(obj.Approver_Action_Date__c != undefined && obj.Approver_Action_Date__c != '') {
            try {
                actionDateTime = (new Date(obj.Approver_Action_Date__c)).toLocaleString('en-AU').toUpperCase().replace(",", "");
            } catch (error) {
                console.log('unable to convert to locale date time string for obj.Approver_Action_Date__c ' + error);
            }
        }
        comments.push({
            date: obj.Approver_Action_Date__c,
            details: actionDateTime + ' | ' + obj["Approver__r.Name"] + ' ('   //.split("-").reverse().join("/")
            + obj.Approver_Action__c + '): ' + obj.Approver_Comments__c
        });
    }
    //comments.sort(function(a, b) {return b.date - a.date});
    return comments;
}

/**
 * Flatten the json, extract child attribute
 * @param {object} data - The json object to be flattened.
 */
const flattenJson = (data) => {
    var result = {};
    function recurse (cur, prop) {
        if (Object(cur) !== cur) {
            result[prop] = cur;
        } else if (Array.isArray(cur)) {
                for(var i=0, l=cur.length; i<l; i++)
                    recurse(cur[i], prop + "[" + i + "]");
            if (l == 0)
                result[prop] = [];
        } else {
            var isEmpty = true;
            for (var p in cur) {
                isEmpty = false;
                recurse(cur[p], prop ? prop+"."+p : p);
            }
            if (isEmpty && prop)
                result[prop] = {};
        }
    }
    recurse(data, "");
    return result;
};

export {
    flattenJson, 
    recalculateItem, 
    formatComments
};