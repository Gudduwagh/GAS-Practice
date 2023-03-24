/*This script is designed to fetch data from Google Ads for a set of account
specified in an input sheet in a Google Sheets spreadsheet, and export the
 data to an output sheet in the same spreadsheet. The script first defines
 the URL of the spreadsheet and the names of the input and output sheets, 
 and then runs a main function that retrieve the account ID from the input
 sheet and fetches the keyword report for specified account. The keyword 
 report includes information such as the top 50 spending keywords, the name of the 
 campaign and ad group, the name of the customer, and the cost of the ad over the
 last 30 days. */
// this is for practice perpose
// Define the URL of the Google Sheets spreadsheet that contains the input and output sheets.
var url = "https://docs.google.com/spreadsheets/d/15BKeU28ct6hlJmn67_F-g88b3OaofewJPX7cOBP4BUI/edit#gid=528933589";

// Define the names of the input and output sheets within the Google Sheets spreadsheet.
var reportsheet = "Output"; 
var accountssheet = "Input from user";

// The main function that runs the script.
function main() {
  Logger.log("Script started.");
  
  // Output a log message indicating that account IDs are being imported from the input sheet.
  Logger.log("Account IDs are being imported from the accounts sheet.");
  
  // Retrieve the accounts associated with the account ID.
  var mccaccount = AdsManagerApp.accounts().withIds(accountids()).get();
  
  while (mccaccount.hasNext()) {
    var accountiterator = mccaccount.next();
    Logger.log("Processing account: " + accountiterator.getName());
    AdsManagerApp.select(accountiterator);
    
    // Fetch the keyword report for the current account, and export the data to the output sheet in the Google Sheets spreadsheet.
    Logger.log("Fetching keyword report for account: " + accountiterator.getName());
    fetchrecord().exportToSheet(spreadsheet(url));
  }
//Changing the existing column name into meaningfull name.
  var range = spreadsheet(url).getRange("A1:E1");
  range.setValues([['Keywords', 'Campaign name', 'Ad groups', 'Account name', 'Cost']]);
  
  
//The unit, micros, is defined as 1,000,000 times the account currency. For example, $1.23 will be returned as 1230000, in micros.
  var range = spreadsheet(url).getRange("E2:E51");
  range.setNumberFormat("$#,##0.00,,");
  
  Logger.log("Script completed.");
}

// Function to retrieve the account ID from the input sheet in the Google Sheets spreadsheet.
function accountids() {
  var account=[];
  var spreadsheet = SpreadsheetApp.openByUrl(url).getSheetByName(accountssheet);
  var activerange = spreadsheet.getRange(2,5).getValue();
  account.push(activerange)
  return account;
}

// Function to retrieve the output sheet from the Google Sheets spreadsheet.
function spreadsheet(URL) {
  var get_spreadsheet = SpreadsheetApp.openByUrl(URL).getSheetByName(reportsheet);
  return get_spreadsheet;
}

// Function to fetch the keyword report for the selected account.
function fetchrecord() {
  var report = AdsApp.report("SELECT ad_group_criterion.keyword.text," +
    "campaign.name," +
    "ad_group.name," +
    "customer.descriptive_name," +
    "metrics.cost_micros " +
    "FROM keyword_view " +
    "WHERE segments.date DURING LAST_30_DAYS " +
    "ORDER BY metrics.cost_micros DESC " +
    "LIMIT 50 ");
  return report;
}





