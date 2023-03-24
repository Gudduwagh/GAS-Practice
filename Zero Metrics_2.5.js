// Zero Metric . Version 2.5. 
// Created by Veronika Loudova.
  
// -------------------- BASIC CONFIGURATION ---------------------------------------------//

// Here, put the email address for the notifications. If you want to put more than one please seperate with commas but no spaces. E.g "jane@groupm.com,joe@groupm.com"
EMAIL_ADDRESS_TO_NOTIFY = " ";

// Here, specify the hours of the day you would like the script to run (leave unchanged to run every hour)
HOURS_TO_RUN = ['00','01','02','03','04','05','06','07','08','09','10','11','12','13','14','15','16','17','18','19','20','21','22','23']

// If the following label is found on an account, this script will check that account's activity.
// To include all accounts, put an empty label in here:     INCLUDE_LABEL_NAME = "";
INCLUDE_LABEL_NAME = "example"; 

// If the following label is found on an account, this script will skip checking that account.
// To include all accounts, put an empty label in here:     EXCLUDE_LABEL_NAME = "";
EXCLUDE_LABEL_NAME = "";

// -------------------- ADVANCED CONFIGURATION ---------------------------------------------//


// Here, specify the number of hours to check
NUMBER_OF_HOURS_TO_CHECK = 2;

// How many hours the script should allow between the current hour and the first one to check (should be one or more)
DELAY = 1

// These four metrics can be checked by the script.
// Use true to check the respective metric.
// Use false to ignore the respective metric.
//
// If any of the metrics is non-zero during any of hours this script is looking back,
// then the account is considered active. Only if all checked metrics turn out to be zero,
// then the account is considered inactive and a notification is sent.
IMPRESSIONS_CHECK = true;
CLICKS_CHECK = false;
COST_CHECK = false;
CONVERSIONS_CHECK = false;

// List of devices to limit the script to.
//
// Example of multiple devices: [ 'MOBILE', 'TABLET', 'DESKTOP', 'CONNECTED_TV' ]
// Leave empty to consider all devices: []
DEVICES = [  ]

// -------------------You do not need to edit under this line ---------------------//

//Changes:
//  2.0 - Multiscript added; move to beta and Google Ads API
//  2.1 - Tracking update
//  2.2 - Add placeholder for account name
//  2.3 - Remove multi script 
//  2.4 - Add device handling
//  2.5 - Add exceptions

var MULTI_SCRIPT_SS = ''
var FORM_URL = 'https://forms.gle/fqsBPJ5sCU14Z22G7'
// Controls the level of the logs should be one of 'debug', 'info', 'warning', 'error'
LOG_LEVEL = 'info' 


var DAYS_MAPPING = {
  'SUNDAY': 0,
  'MONDAY': 1,
  'TUESDAY': 2,
  'WEDNESDAY': 3,
  'THURSDAY': 4,
  'FRIDAY': 5,
  'SATURDAY': 6,
};

function main() {
  
  if (!shouldRun()) {
   return 
  }
  var accountIterator = AdsManagerApp.accounts();

  if (EXCLUDE_LABEL_NAME.length > 0) {
    accountIterator = accountIterator.withCondition(
      'LabelNames DOES_NOT_CONTAIN "' + EXCLUDE_LABEL_NAME + '"'
    );
  }
  if (INCLUDE_LABEL_NAME.length > 0) {
    accountIterator = accountIterator.withCondition(
      'LabelNames CONTAINS "' + INCLUDE_LABEL_NAME + '"'
    );
  }
  accountIterator = accountIterator.get();
  if (accountIterator.totalNumEntities() == 0) {
   throw('No accounts selected - please update the account label(s) and rerun the script. If you have issues see the troubleshooting guide for info about account labels.') 
  }

  var zeroMetric = [];
  var accountIds = [];
  var multiScriptInfo = [];
  while (accountIterator.hasNext()) {
    var account = accountIterator.next();
    processAccount(account, multiScriptInfo, zeroMetric);
    accountIds.push(account.getCustomerId());
  }

  if (!zeroMetric.length) {
    log(
      "ALL OK! All accounts seem to be active in the last " +
        NUMBER_OF_HOURS_TO_CHECK +
        " hours."
    );
  } else {
    var subject = "Some Accounts Have Dropped to Zero";
    var body = "For the last " + NUMBER_OF_HOURS_TO_CHECK + " hours the accounts below have dropped to zero for these metrics: " + getMetricString() + ". You may want to check this out. <br><br>Please contact your local super user you need support. If that does not solve the problem please use our <a href=%form>support form</a> to register an issue.<br></br>" + zeroMetric.join("<br/>");
    var body = body.replace('%form',FORM_URL);

    sendEmailNotifications(EMAIL_ADDRESS_TO_NOTIFY, subject, body, "warning"); 
    log(
      "WARNING: Some accounts seem to be inactive in the last " +
        NUMBER_OF_HOURS_TO_CHECK +
        " hours."
    );
  }
  sendToUsageMonitoring(EMAIL_ADDRESS_TO_NOTIFY, accountIds);
  writeToMulti(multiScriptInfo, 'n/a');
}

function processAccount(account, multiScriptInfo, zeroMetric) {
  var dateRange = getDateRange();
  log("Account: " + account.getName() + " " + JSON.stringify(DEVICES));
  AdsManagerApp.select(account);
  
  var queryText =
      "SELECT metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, segments.day_of_week, segments.hour, segments.device"
      + " FROM customer"
      + " WHERE segments.date BETWEEN " + dateRange
  
  if (DEVICES.length > 0)
        queryText += " AND segments.device IN " + JSON.stringify(DEVICES).replace('[', '(').replace(']', ')')
  
  var result = AdsApp.report(queryText);
  var rows = result.rows();

  var impressionsByHour = {};
  var clicksByHour = {};
  var costByHour = {};
  var conversionsByHour = {};

  while (rows.hasNext()) {
    var currentRow = rows.next();
    var hourFactor = parseFloat(currentRow["segments.hour"]);
    var weekHour = getWeekHour(currentRow["segments.day_of_week"], hourFactor)
    impressionsByHour[weekHour] = currentRow["metrics.impressions"];
    clicksByHour[weekHour] = currentRow["metrics.clicks"];
    costByHour[weekHour] = currentRow["metrics.cost_micros"];
    conversionsByHour[weekHour] = currentRow["metrics.conversions"];

  }

  // check if an entry exists for any of the last 6 hours
  var hoursToCheck = weekHoursToCheck();
  log('Checking these week hours...')
  log(hoursToCheck)
  
  for (var i = 0; i < hoursToCheck.length; i++) {
    
    var hourIndexToCheck = hoursToCheck[i];

    if (
      IMPRESSIONS_CHECK &&
      impressionsByHour[hourIndexToCheck] != undefined &&
      impressionsByHour[hourIndexToCheck] != 0
    ) {
      log(
        "... ALL OK! The Account seems to be active in the last " + NUMBER_OF_HOURS_TO_CHECK + " hours: impressionsCheck " + impressionsByHour[hourIndexToCheck] + " weekHour " + hourIndexToCheck
      );
      return false;
    }
    if (
      CLICKS_CHECK &&
      clicksByHour[hourIndexToCheck] != undefined &&
      clicksByHour[hourIndexToCheck] != 0
    ) {
      log(
        "... ALL OK! The Account seems to be active in the last " + NUMBER_OF_HOURS_TO_CHECK + " hours: clicksCheck " + clicksByHour[hourIndexToCheck] + " weekHour " + hourIndexToCheck
      );
      return false;
    }
    if (
      COST_CHECK &&
      costByHour[hourIndexToCheck] != undefined &&
      costByHour[hourIndexToCheck] != 0
    ) {
      log(
        "... ALL OK! The Account seems to be active in the last " + NUMBER_OF_HOURS_TO_CHECK + " hours: costCheck " + costByHour[hourIndexToCheck] + " weekHour " + hourIndexToCheck
      );
      return false;
    }
    if (
      CONVERSIONS_CHECK &&
      conversionsByHour[hourIndexToCheck] != undefined &&
      conversionsByHour[hourIndexToCheck] != 0
    ) {
      log(
        "... ALL OK! The Account seems to be active in the last " + NUMBER_OF_HOURS_TO_CHECK + " hours: conversionsCheck " + conversionsByHour[hourIndexToCheck] + " weekHour " + hourIndexToCheck
      );
      return false;
    }
  }

  zeroMetric.push(account.getName());
  multiScriptInfo.push({'accountName' : account.getName(), 'accountId' : account.getCustomerId(), 'value' : 1})
  log(account.getName() + " seems to be inactive in the last " + NUMBER_OF_HOURS_TO_CHECK + " hours.",'warning');
  return true;
}

function weekHoursToCheck() {
  var currentDate = new Date();
  var timeZone = AdsApp.currentAccount().getTimeZone();
  log('Current Date: ' + currentDate) 
  var currentHour = parseInt(Utilities.formatDate(currentDate, timeZone, 'HH'), 10);
  var currentDay = Utilities.formatDate(currentDate, timeZone, 'EEEE').toUpperCase(); 
  var currentWeekHour = getWeekHour(currentDay, currentHour)
  log('Current Week Hour: ' + currentWeekHour)
  
  var weekHours = [];
  for (var i = DELAY; i < NUMBER_OF_HOURS_TO_CHECK + DELAY; i++) {
    weekHours.push(currentWeekHour - i);
  }
  return weekHours;
}


function getWeekHour(day, hour) {
 return (DAYS_MAPPING[day] * 24) + hour
}


function sendEmailNotifications(emailAddresses, subject, body, emailType) {
  if (emailAddresses == "") {
   Logger.log('no emails set - skipping sending')
   return;
  }
  if (emailType.toLowerCase().indexOf("warning") != -1) {
    var finalSubject = "[Warning] " + subject;
  } else if (emailType.toLowerCase().indexOf("notification") != -1) {
    var finalSubject = "[Notification] " + subject;
  }

  var finalBody = body;

  MailApp.sendEmail({
    to: emailAddresses,
    subject: finalSubject,
    htmlBody: finalBody,
  });
}


function getMetricString() {
 var ms = []
 if (IMPRESSIONS_CHECK) {
   ms.push('impressions')
 };
 if (CLICKS_CHECK) {
   ms.push('clicks')
 };
 if (COST_CHECK) {
   ms.push('cost')
 };
 if (CONVERSIONS_CHECK) {
   ms.push('conversions')
 };
 return ms.join(', ')
}

function getDateRange() {
  var start = getFormattedDate(1);
  var today = getFormattedDate(0);
  return '"' + start + '" AND "' + today + '"';
}


function getFormattedDate(daysAgo) {
  // thanks to - https://developers.google.com/adwords/scripts/docs/features/dates#creating_a_date_object_from_a_formatted_date_string
  var millisADay = 1000 * 60 * 60 * 24;
  var date = new Date (new Date() - (millisADay * daysAgo))
  return Utilities.formatDate(date, AdWordsApp.currentAccount().getTimeZone(), 'yyyy-MM-dd')
}



// shouldRun 

function shouldRun() {
 var hour = getHourOfDay()
 var run = (HOURS_TO_RUN.indexOf(hour) > -1)
 if (!run) {
  log('No run scheduled for hour: ' + hour) 
  log('If you want the script to run at this time update the value of "HOURS_TO_RUN"')
 }
 return run
}

function getDateStringInTimeZone(format, date, timeZone) {
  date = date || new Date();
  timeZone = timeZone || AdWordsApp.currentAccount().getTimeZone();
  return Utilities.formatDate(date, timeZone, format);
}  


function getHourOfDay() {
 return getDateStringInTimeZone('HH', new Date(), AdsApp.currentAccount().getTimeZone()) 
}


// Utils

function log(msg, level) {
    var level = level || 'info'
    var logLevels = ['debug', 'info', 'warning', 'error']
    if (logLevels.indexOf(level) >= logLevels.indexOf(LOG_LEVEL)) {
        Logger.log('[' + level.toUpperCase() + '] ' + msg)
    }
}


// Tracking

SCRIPT_NAME = 'ZERO_METRIC'
var SCRIPT_VERSION = '2.5'
MANAGER_NAME = '--'
MANAGER_ID = '111-111-1111'


/*
Write data to Multi Script tracker 
 accountInfo: [{'accountName' : str, 'accountId': str, 'value': int}...] 
 url: str
*/
function writeToMulti(accountInfo, url) {
  if (MULTI_SCRIPT_SS == "") {log('No multi script url provided; skipping sending info'); return}
  if (accountInfo.length == 0) {log('No info; skipping sending to multi'); return}
  var date = new Date()
  var preview = AdsApp.getExecutionInfo().isPreview()
  var data = accountInfo.map(function (account) {
    return [date, MANAGER_ID, MANAGER_NAME, account.accountName, account.accountId, SCRIPT_NAME, account.value, preview, "--"]
  })
  var sheet = SpreadsheetApp.openByUrl(MULTI_SCRIPT_SS).getSheetByName('Data')
  sheet.getRange(sheet.getLastRow()+1,1,data.length,data[0].length).setValues(data)
}


function sendToUsageMonitoring(emails, accountIds) {
    var formData = { "emails": emails, "accounts": generateAccountInfo(accountIds), "script": SCRIPT_NAME, "manager_id": MANAGER_ID, "manager_name": MANAGER_NAME, "script_version" : SCRIPT_VERSION }
    var options = { 'method': 'post', 'payload': JSON.stringify(formData), 'headers': { "Authorization": "Basic " + Utilities.base64Encode('zero-metric:' + retrieveCred('zero_metric')) } }
    var response = UrlFetchApp.fetch('https://dev-api-5mpnt64nka-ew.a.run.app/items', options)
    Logger.log('Monitoring: ' + response) 
}

function generateAccountInfo(accountIds) {
  var res = accountIds.map(function(accountId) {
    log(`Converting ${accountId} to ${formatAccountId(accountId)}`)
    return {'account_id' : formatAccountId(accountId),'account_name': '--'} 
  })
  return res
}


function formatAccountId(accountId) {
 var accountId = accountId.toString()
 if  (accountId.includes('-')) {
   return accountId
 } else {
  return `${accountId.slice(0, 3)}-${accountId.slice(3, 6)}-${accountId.slice(6, 10)}` 
 }
}


function retrieveCred(credName) {
  const sheetId = '1aw5fJuUQ0jltkWfYH8hBaoAr_wFQCDBpUMtJ-v_-Ak0'
  try {
    const ss = SpreadsheetApp.openById(sheetId)
    return ss.getRangeByName(credName).getValue()
  } catch (e) {
    Logger.log(e) 
    throw('Please request access to this doc, you will only need to do this once: https://docs.google.com/spreadsheets/d/' + sheetId)
  }
}

