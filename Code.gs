/**
 * ============================================================================
 * BACKEND CONTROLLER - MATAHARI STORE VISIT AUDIT & ANALYTICS
 * Full Dynamic Resolver, Subordinate Visibility, BOLA Defense & Strict Types
 * ============================================================================
 */

function doGet(e) {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Matahari Store Visit Audit & Analytics')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function buildHeaderIndexMap(headerRow) {
  var map = {};
  if (!Array.isArray(headerRow)) return map;
  headerRow.forEach(function(col, idx) {
    if (col !== null && col !== undefined) {
      var cleanKey = String(col).trim().toUpperCase().replace(/[\s\-_.]+/g, '_');
      map[cleanKey] = idx;
    }
  });
  return map;
}

function normalizeInternalRole(rawRole) {
  if (!rawRole) return "SA";
  var r = String(rawRole).trim().toUpperCase();
  if (r === "RM" || r.indexOf("REGIONAL") !== -1) return "RM";
  if (r === "SM" || (r.indexOf("STORE_MANAGER") !== -1 && r.indexOf("ASST") === -1 && r.indexOf("ASSISTANT") === -1)) return "SM";
  if (r === "ASM" || r.indexOf("ASST") !== -1 || r.indexOf("ASSISTANT") !== -1) return "ASM";
  if (r === "SA" || r.indexOf("SUPERVISOR") !== -1 || r.indexOf("SPV") !== -1) return "SA";
  if (r === "ADMIN" || r.indexOf("ADMIN") !== -1 || r === "HQ") return "ADMIN";
  return "SA";
}

function formatToSafeWibString(rawVal) {
  if (!rawVal) return "";
  if (rawVal instanceof Date) {
    return Utilities.formatDate(rawVal, "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss");
  }
  var str = String(rawVal).trim();
  if (str.indexOf("T") !== -1) {
    var parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return Utilities.formatDate(parsed, "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss");
    }
  }
  return str;
}

// 1. VERIFIKASI LOGIN
function verifyLoginCredentials(userId, inputPassword) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var empSheet = ss.getSheetByName("Employee_Master");
    if (!empSheet) return { success: false, message: "Sheet Employee_Master tidak ditemukan!" };

    var data = empSheet.getDataRange().getValues();
    if (data.length <= 1) return { success: false, message: "Data Employee_Master kosong!" };

    var hMap = buildHeaderIndexMap(data[0]);
    var colId = hMap["ID"] !== undefined ? hMap["ID"] : 0;
    var colName = hMap["NAME"] !== undefined ? hMap["NAME"] : 1;
    var colStore = hMap["STORE_CODE"] !== undefined ? hMap["STORE_CODE"] : (hMap["STORE_COD"] !== undefined ? hMap["STORE_COD"] : 2);
    var colRole = hMap["ROLE"] !== undefined ? hMap["ROLE"] : 3;
    var colPass = hMap["PASSWORD"] !== undefined ? hMap["PASSWORD"] : 4;
    var colJob = hMap["JOB_TITLE"] !== undefined ? hMap["JOB_TITLE"] : 6;
    var colStatus = hMap["STATUS"] !== undefined ? hMap["STATUS"] : 7;

    var cleanInputId = String(userId || "").trim().toUpperCase();
    var cleanInputPass = String(inputPassword || "").trim();

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[colId]) continue;

      var dbId = String(row[colId]).trim().toUpperCase();
      var dbPass = String(row[colPass] !== undefined ? row[colPass] : "").trim();
      var dbStatus = String(row[colStatus] || "ACTIVE").trim().toUpperCase();

      if (dbId === cleanInputId) {
        if (dbStatus !== "ACTIVE" && dbStatus !== "AKTIF") {
          return { success: false, message: "Akun ini berstatus NON-AKTIF!" };
        }
        if (dbPass !== cleanInputPass) {
          return { success: false, message: "PIN / Password salah!" };
        }

        var internalRole = normalizeInternalRole(row[colRole]);
        var officialJobTitle = String(row[colJob] || row[colRole] || internalRole).trim();

        return {
          success: true,
          user: {
            id: String(row[colId]).trim(),
            name: String(row[colName] || "").trim(),
            storeCode: String(row[colStore] || "ALL").trim(),
            role: internalRole,
            jobTitle: officialJobTitle
          }
        };
      }
    }

    return { success: false, message: "NIK / ID Karyawan tidak terdaftar!" };
  } catch (err) {
    return { success: false, message: "Error otentikasi: " + err.toString() };
  }
}

// 2. GET MASTER DATA
function getMasterData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var stores = [], questions = [], brands = [], divisions = [];

  var sSheet = ss.getSheetByName("Store_Master");
  if (sSheet) {
    var sData = sSheet.getDataRange().getValues();
    if (sData.length > 1) {
      var sMap = buildHeaderIndexMap(sData[0]);
      var cCode = sMap["SITE_CODE"] !== undefined ? sMap["SITE_CODE"] : 0;
      var cName = sMap["SITE_NAME"] !== undefined ? sMap["SITE_NAME"] : 1;
      var cReg = sMap["REGION"] !== undefined ? sMap["REGION"] : 2;
      var cRM = sMap["REGIONAL_MANAGER"] !== undefined ? sMap["REGIONAL_MANAGER"] : 3;
      var cLat = sMap["LATITUDE"] !== undefined ? sMap["LATITUDE"] : 4;
      var cLng = sMap["LONGITUDE"] !== undefined ? sMap["LONGITUDE"] : 5;

      for (var i = 1; i < sData.length; i++) {
        if (sData[i][cCode]) {
          stores.push({
            siteCode: String(sData[i][cCode]).trim(),
            siteName: String(sData[i][cName] || "").trim(),
            region: String(sData[i][cReg] || "").trim(),
            regionalManager: String(sData[i][cRM] || "").trim(),
            lat: parseFloat(sData[i][cLat]) || 0,
            lng: parseFloat(sData[i][cLng]) || 0
          });
        }
      }
    }
  }

  var qSheet = ss.getSheetByName("Question_Bank");
  if (qSheet) {
    var qData = qSheet.getDataRange().getValues();
    if (qData.length > 1) {
      var qMap = buildHeaderIndexMap(qData[0]);
      var cQId = qMap["QUESTION_ID"] !== undefined ? qMap["QUESTION_ID"] : (qMap["ITEM_ID"] !== undefined ? qMap["ITEM_ID"] : 0);
      var cQCat = qMap["CATEGORY"] !== undefined ? qMap["CATEGORY"] : 1;
      var cQText = qMap["QUESTION_TEXT"] !== undefined ? qMap["QUESTION_TEXT"] : 2;
      var cQStd = qMap["STANDARD"] !== undefined ? qMap["STANDARD"] : (qMap["RESPONSE_TYPE"] !== undefined ? qMap["RESPONSE_TYPE"] : 3);
      var cQRole = qMap["REQUIRED_ROLE"] !== undefined ? qMap["REQUIRED_ROLE"] : (qMap["ROLE"] !== undefined ? qMap["ROLE"] : 5);
      var cQFreq = qMap["FREQUENCY"] !== undefined ? qMap["FREQUENCY"] : 6;
      var cQType = qMap["CHECKLIST_TYPE"] !== undefined ? qMap["CHECKLIST_TYPE"] : 7;

      for (var j = 1; j < qData.length; j++) {
        if (qData[j][cQId]) {
          var rawType = String(qData[j][cQType] || "REGULAR").trim().toUpperCase();
          if (!rawType || rawType === "NULL" || rawType === "UNDEFINED") rawType = "REGULAR";

          questions.push({
            id: String(qData[j][cQId]).trim(),
            category: String(qData[j][cQCat] || "OPERASIONAL").trim(),
            text: String(qData[j][cQText] || "").trim(),
            standard: String(qData[j][cQStd] || "Pass/Fail").trim(),
            weight: 1,
            requiredRole: String(qData[j][cQRole] || "ALL").trim().toUpperCase(),
            frequency: String(qData[j][cQFreq] || "Daily").trim(),
            checklistType: rawType
          });
        }
      }
    }
  }

  var bSheet = ss.getSheetByName("list_brand");
  if (bSheet) {
    var bData = bSheet.getDataRange().getValues();
    for (var k = 1; k < bData.length; k++) {
      if (bData[k][0]) {
        brands.push({ name: String(bData[k][1] || bData[k][0]).trim() });
      }
    }
  }

  var dSheet = ss.getSheetByName("list_division");
  if (dSheet) {
    var dData = dSheet.getDataRange().getValues();
    for (var l = 1; l < dData.length; l++) {
      if (dData[l][0]) {
        divisions.push({ name: String(dData[l][1] || dData[l][0]).trim() });
      }
    }
  }

  return { stores: stores, questions: questions, brands: brands, divisions: divisions };
}

// 3. GET HISTORICAL REPORTS (SUBORDINATE CAN VIEW SUPERIOR AT SAME STORE)
function getHistoricalReports(role, siteCode, region, userId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var reports = [];
  var actionItems = [];
  var employees = [];
  var now = new Date();

  // Index Store Master
  var storeMap = {};
  var sSheet = ss.getSheetByName("Store_Master");
  if (sSheet) {
    var sData = sSheet.getDataRange().getValues();
    if (sData.length > 1) {
      var smMap = buildHeaderIndexMap(sData[0]);
      var cSc = smMap["SITE_CODE"] !== undefined ? smMap["SITE_CODE"] : 0;
      var cSn = smMap["SITE_NAME"] !== undefined ? smMap["SITE_NAME"] : 1;
      for (var s = 1; s < sData.length; s++) {
        if (sData[s][cSc]) {
          storeMap[String(sData[s][cSc]).trim()] = String(sData[s][cSn] || "").trim();
        }
      }
    }
  }

  // Index Employee Master
  var empSheet = ss.getSheetByName("Employee_Master");
  var empLookup = {};
  if (empSheet) {
    var eData = empSheet.getDataRange().getValues();
    if (eData.length > 1) {
      var eMap = buildHeaderIndexMap(eData[0]);
      var colId = eMap["ID"] !== undefined ? eMap["ID"] : 0;
      var colName = eMap["NAME"] !== undefined ? eMap["NAME"] : 1;
      var colStore = eMap["STORE_CODE"] !== undefined ? eMap["STORE_CODE"] : (eMap["STORE_COD"] !== undefined ? eMap["STORE_COD"] : 2);
      var colRole = eMap["ROLE"] !== undefined ? eMap["ROLE"] : 3;
      var colJob = eMap["JOB_TITLE"] !== undefined ? eMap["JOB_TITLE"] : 6;
      var colStatus = eMap["STATUS"] !== undefined ? eMap["STATUS"] : 7;

      for (var e = 1; e < eData.length; e++) {
        var erow = eData[e];
        if (!erow[colId]) continue;

        var st = String(erow[colStatus] || "ACTIVE").trim().toUpperCase();
        if (st === "ACTIVE" || st === "AKTIF") {
          var normR = normalizeInternalRole(erow[colRole]);
          var offJob = String(erow[colJob] || erow[colRole] || normR).trim();
          var empObj = {
            id: String(erow[colId]).trim(),
            name: String(erow[colName] || "").trim(),
            storeCode: String(erow[colStore] || "").trim(),
            role: normR,
            jobTitle: offJob
          };
          if (normR !== "ADMIN") employees.push(empObj);
          empLookup[empObj.id.toUpperCase()] = empObj;
          empLookup[empObj.name.toUpperCase()] = empObj;
        }
      }
    }
  }

  var cleanUid = String(userId || "").trim().toUpperCase();
  var currentUser = empLookup[cleanUid] || {
    id: userId || "USER",
    name: "",
    storeCode: siteCode || "ALL",
    role: normalizeInternalRole(role || "RM"),
    jobTitle: role || "REGIONAL MANAGER"
  };

  // 1. Baca Action_Items
  var actSheet = ss.getSheetByName("Action_Items");
  var auditActionStatusMap = {};

  if (actSheet) {
    var actData = actSheet.getDataRange().getValues();
    if (actData.length > 1) {
      var aMap = buildHeaderIndexMap(actData[0]);
      var cActId = aMap["ACTION_ID"] !== undefined ? aMap["ACTION_ID"] : 0;
      var cActAuditId = aMap["AUDIT_ID"] !== undefined ? aMap["AUDIT_ID"] : 1;
      var cActTime = aMap["TIMESTAMP"] !== undefined ? aMap["TIMESTAMP"] : 2;
      var cActSite = aMap["SITE_CODE"] !== undefined ? aMap["SITE_CODE"] : (aMap["STORE_CODE"] !== undefined ? aMap["STORE_CODE"] : 3);
      var cActAuditor = aMap["AUDITOR_NAME"] !== undefined ? aMap["AUDITOR_NAME"] : 4;
      var cActRole = aMap["AUDITOR_ROLE"] !== undefined ? aMap["AUDITOR_ROLE"] : 5;
      var cActQId = aMap["QUESTION_ID"] !== undefined ? aMap["QUESTION_ID"] : 6;
      var cActQText = aMap["QUESTION_TEXT"] !== undefined ? aMap["QUESTION_TEXT"] : 7;
      var cActRemarks = aMap["FINDING_REMARKS"] !== undefined ? aMap["FINDING_REMARKS"] : 8;
      var cActStatus = aMap["STATUS_PERBAIKAN"] !== undefined ? aMap["STATUS_PERBAIKAN"] : (aMap["STATUS"] !== undefined ? aMap["STATUS"] : 9);
      var cActPlan = aMap["SUBORDINATE_REMARKS"] !== undefined ? aMap["SUBORDINATE_REMARKS"] : (aMap["ACTION_PLAN"] !== undefined ? aMap["ACTION_PLAN"] : 10);
      var cActUpdated = aMap["UPDATED_AT"] !== undefined ? aMap["UPDATED_AT"] : 11;
      var cActPhoto = aMap["PHOTO_URL"] !== undefined ? aMap["PHOTO_URL"] : 12;

      for (var j = 1; j < actData.length; j++) {
        var arow = actData[j];
        if (!arow[cActId]) continue;

        var aAuditId = String(arow[cActAuditId] || "").trim();
        var aStore = String(arow[cActSite] || "").trim();
        var aAuditor = String(arow[cActAuditor] || "").trim();
        var itemStatus = String(arow[cActStatus] || "Pending").trim();

        if (aAuditId) {
          if (!auditActionStatusMap[aAuditId]) auditActionStatusMap[aAuditId] = [];
          auditActionStatusMap[aAuditId].push(itemStatus.toLowerCase());
        }

        // HAK AKSES TEMUAN: JIKA BUKAN RM/ADMIN, WAJIB TOKO YANG SAMA
        if (currentUser.role !== "ADMIN" && currentUser.role !== "RM") {
          if (currentUser.storeCode && currentUser.storeCode !== "ALL" && aStore !== currentUser.storeCode) {
            continue;
          }
        }

        var matchedActEmp = empLookup[aAuditor.toUpperCase()];
        var actJobTitle = matchedActEmp ? matchedActEmp.jobTitle : String(arow[cActRole] || "AUDITOR").trim();

        var aTimeStr = formatToSafeWibString(arow[cActTime]);
        var aDateObj = new Date(aTimeStr);
        var updatedStr = formatToSafeWibString(arow[cActUpdated]);
        var updatedObj = updatedStr ? new Date(updatedStr) : now;

        var ageHours = isNaN(aDateObj.getTime()) ? 0 : Math.round((now.getTime() - aDateObj.getTime()) / (1000 * 60 * 60));
        var slaDays = 0;
        if (!isNaN(aDateObj.getTime()) && !isNaN(updatedObj.getTime())) {
          var diffMs = updatedObj.getTime() - aDateObj.getTime();
          slaDays = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
        }

        var realStoreName = storeMap[aStore] || ("Toko " + aStore);

        actionItems.push({
          actionId: String(arow[cActId]).trim(),
          auditId: aAuditId,
          timestamp: aTimeStr,
          siteCode: aStore,
          siteName: realStoreName,
          auditorName: aAuditor,
          auditorRole: actJobTitle,
          jobTitle: actJobTitle,
          questionId: String(arow[cActQId] || "").trim(),
          questionText: String(arow[cActQText] || "Butir Pemeriksaan SOP").trim(),
          issueDescription: String(arow[cActRemarks] || "Temuan Fail").trim(),
          actionPlan: String(arow[cActPlan] || "Rencana tindak lanjut").trim(),
          status: itemStatus,
          photoUrl: String(arow[cActPhoto] || "").trim(),
          ageHours: ageHours,
          slaDays: slaDays,
          isOverdue: (ageHours > 48 && itemStatus.toLowerCase() !== "archived")
        });
      }
    }
  }

  // 2. Baca Sheet Laporan (Report_XX)
  var sheetNames = ["Report_SA", "Report_ASM", "Report_SM", "Report_RM", "Report_ADMIN"];
  sheetNames.forEach(function(sName) {
    var sheet = ss.getSheetByName(sName);
    if (!sheet) return;
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) return;

    var rMap = buildHeaderIndexMap(data[0]);
    var cAuditId = rMap["AUDIT_ID"] !== undefined ? rMap["AUDIT_ID"] : 0;
    var cTimestamp = rMap["TIMESTAMP"] !== undefined ? rMap["TIMESTAMP"] : 1;
    var cPace = rMap["AUDIT_PACE_FLAG"] !== undefined ? rMap["AUDIT_PACE_FLAG"] : 4;
    var cSiteCode = rMap["SITE_CODE"] !== undefined ? rMap["SITE_CODE"] : 5;
    var cSiteName = rMap["SITE_NAME"] !== undefined ? rMap["SITE_NAME"] : 6;
    var cRegion = rMap["REGION"] !== undefined ? rMap["REGION"] : 7;
    var cRM = rMap["REGIONAL_MANAGER"] !== undefined ? rMap["REGIONAL_MANAGER"] : 8;
    var cAuditorName = rMap["AUDITOR_NAME"] !== undefined ? rMap["AUDITOR_NAME"] : 9;
    var cAuditorRole = rMap["AUDITOR_ROLE"] !== undefined ? rMap["AUDITOR_ROLE"] : 10;
    var cDivision = rMap["DIVISION"] !== undefined ? rMap["DIVISION"] : 11;
    var cFreq = rMap["FREQUENCY"] !== undefined ? rMap["FREQUENCY"] : 13;
    var cScore = rMap["SCORE_%"] !== undefined ? rMap["SCORE_%"] : (rMap["SCORE"] !== undefined ? rMap["SCORE"] : 14);
    var cYes = rMap["TOTAL_YES"] !== undefined ? rMap["TOTAL_YES"] : 15;
    var cNo = rMap["TOTAL_NO"] !== undefined ? rMap["TOTAL_NO"] : 16;
    var cStatus = rMap["STATUS"] !== undefined ? rMap["STATUS"] : 19;
    var cCheckType = rMap["CHECKLIST_TYPE"] !== undefined ? rMap["CHECKLIST_TYPE"] : 20;

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[cAuditId]) continue;

      var storeVal = String(row[cSiteCode] || "").trim();
      var auditorNameVal = String(row[cAuditorName] || "").trim();
      var rawAuditorRole = String(row[cAuditorRole] || "SA").trim();
      var auditIdVal = String(row[cAuditId]).trim();

      // HAK AKSES LAPORAN: SUBORDINATE BISA MELIHAT LAPORAN SUPERIOR DI TOKO YANG SAMA
      if (currentUser.role !== "ADMIN" && currentUser.role !== "RM") {
        if (currentUser.storeCode && currentUser.storeCode !== "ALL" && storeVal !== currentUser.storeCode) {
          continue;
        }
      }

      var matchedEmp = empLookup[auditorNameVal.toUpperCase()];
      var officialJob = matchedEmp ? matchedEmp.jobTitle : rawAuditorRole;

      var timeStr = formatToSafeWibString(row[cTimestamp]);

      // SANITASI NAMA TOKO LENGKAP
      var resolvedStoreName = storeMap[storeVal];
      if (!resolvedStoreName || resolvedStoreName === storeVal) {
        resolvedStoreName = String(row[cSiteName] || "").trim();
        if (!resolvedStoreName || resolvedStoreName === storeVal) {
          resolvedStoreName = "Toko " + storeVal;
        }
      }

      // KALKULASI STATUS DINAMIS
      var totalFail = Number(row[cNo]) || 0;
      var computedStatus = "Completed";

      if (totalFail > 0) {
        var actionStatuses = auditActionStatusMap[auditIdVal] || [];
        var hasPending = false;
        var hasInProgress = false;

        if (actionStatuses.length === 0) {
          hasPending = true;
        } else {
          for (var aIdx = 0; aIdx < actionStatuses.length; aIdx++) {
            var stStr = actionStatuses[aIdx];
            if (stStr === "pending") hasPending = true;
            if (stStr === "in progress") hasInProgress = true;
          }
        }

        if (hasPending) {
          computedStatus = "Waiting Follow Up";
        } else if (hasInProgress) {
          computedStatus = "Waiting Approval";
        } else {
          computedStatus = "Completed";
        }
      } else {
        computedStatus = "Completed";
      }

      var rawType = String(row[cCheckType] || "REGULAR").trim().toUpperCase();
      if (!rawType || rawType === "NULL" || rawType === "UNDEFINED") rawType = "REGULAR";

      reports.push({
        auditId: auditIdVal,
        timestamp: timeStr,
        siteCode: storeVal,
        siteName: resolvedStoreName,
        region: String(row[cRegion] || "").trim(),
        regionalManager: String(row[cRM] || "").trim(),
        auditorName: auditorNameVal,
        auditorRole: officialJob,
        jobTitle: officialJob,
        division: String(row[cDivision] || "").trim(),
        frequency: String(row[cFreq] || "Daily").trim(),
        checklistType: rawType,
        score: row[cScore] || 0,
        totalYes: Number(row[cYes]) || 0,
        totalNo: totalFail,
        paceFlag: String(row[cPace] || "NORMAL").trim(),
        processStatus: computedStatus
      });
    }
  });

  return { reports: reports, actionItems: actionItems, employees: employees };
}

// 4. SUBMIT WALKTHROUGH DENGAN BATCH WRITE & ISOLASI TIPE EKSPLISIT
function submitAuditWalkthrough(payload) {
  var lock = LockService.getScriptLock();
  lock.tryLock(15000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var curRole = normalizeInternalRole(payload.auditorRole);
    var targetSheetName = "Report_" + curRole;
    var sheet = ss.getSheetByName(targetSheetName);
    if (!sheet) sheet = ss.getSheetByName("Report_SA");

    var now = new Date();
    var nowWibStr = Utilities.formatDate(now, "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss");
    var auditId = "AUD-" + payload.siteCode + "-" + now.getTime();

    var answers = payload.answers || [];
    var totalQuestions = answers.length;
    var passCount = 0;
    var failCount = 0;
    var actionRowsStaged = [];

    answers.forEach(function(ans) {
      if (ans.status === "Pass") {
        passCount++;
      } else if (ans.status === "Fail") {
        failCount++;
        var actId = "ACT-" + auditId.replace("AUD-", "") + "-" + (ans.questionId || "FAIL");
        actionRowsStaged.push([
          actId,
          auditId,
          nowWibStr,
          payload.siteCode,
          payload.auditorName,
          payload.auditorRole,
          ans.questionId,
          ans.questionText || "Standar SOP",
          ans.issue || "Temuan Fail",
          "Pending",
          ans.actionPlan || "Rencana Perbaikan",
          nowWibStr,
          ans.photoBase64 ? "DATA_ATTACHED" : ""
        ]);
      }
    });

    // BATCH WRITE ACTION ITEMS
    if (actionRowsStaged.length > 0) {
      var actionSheet = ss.getSheetByName("Action_Items");
      if (actionSheet) {
        var lastRow = actionSheet.getLastRow();
        actionSheet.getRange(lastRow + 1, 1, actionRowsStaged.length, actionRowsStaged[0].length).setValues(actionRowsStaged);
      }
    }

    var scorePct = totalQuestions > 0 ? Math.round((passCount / totalQuestions) * 100) + "%" : "100%";
    var initialStatus = failCount > 0 ? "Waiting Follow Up" : "Completed";
    var explicitType = String(payload.checklistType || "REGULAR").trim().toUpperCase();

    if (sheet) {
      sheet.appendRow([
        auditId,
        nowWibStr,
        payload.startTime || nowWibStr,
        payload.durationSeconds || 300,
        "NORMAL",
        payload.siteCode,
        payload.siteName || payload.siteCode,
        payload.region || "Greater Jakarta",
        payload.regionalManager || "",
        payload.auditorName,
        payload.auditorRole,
        payload.division || "ALL",
        payload.auditedPosition || curRole,
        payload.frequency || "Daily",
        scorePct,
        passCount,
        failCount,
        payload.gps || "",
        payload.notes || "",
        initialStatus,
        explicitType
      ]);
    }

    return { success: true, auditId: auditId, score: scorePct };
  } catch (err) {
    return { success: false, message: err.toString() };
  } finally {
    lock.releaseLock();
  }
}

// 5. UPDATE TINDAK LANJUT / REMIND SM (APPSEC BOLA DEFENSE)
function updateActionItemRecord(actionId, newStatus, subordinateNotes, isReminder, callerStoreCode, callerRole) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Action_Items");
    if (!sheet) return { success: false, message: "Sheet Action_Items tidak ditemukan" };

    var data = sheet.getDataRange().getValues();
    var hMap = buildHeaderIndexMap(data[0]);
    var cActId = hMap["ACTION_ID"] !== undefined ? hMap["ACTION_ID"] : 0;
    var cSite = hMap["SITE_CODE"] !== undefined ? hMap["SITE_CODE"] : (hMap["STORE_CODE"] !== undefined ? hMap["STORE_CODE"] : 3);
    var cStatus = hMap["STATUS_PERBAIKAN"] !== undefined ? hMap["STATUS_PERBAIKAN"] : 9;
    var cNotes = hMap["SUBORDINATE_REMARKS"] !== undefined ? hMap["SUBORDINATE_REMARKS"] : 10;
    var cUpdated = hMap["UPDATED_AT"] !== undefined ? hMap["UPDATED_AT"] : 11;

    var nowStr = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss");
    var cRoleNorm = normalizeInternalRole(callerRole);

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][cActId]).trim() === String(actionId).trim()) {
        var rowStore = String(data[i][cSite] || "").trim();

        // BOLA / IDOR DEFENSE
        if (cRoleNorm !== "RM" && cRoleNorm !== "ADMIN") {
          if (callerStoreCode && callerStoreCode !== "ALL" && rowStore !== String(callerStoreCode).trim()) {
            return { success: false, message: "Akses Ditolak: Anda tidak memiliki wewenang pada unit toko ini!" };
          }
        }

        var rowNum = i + 1;
        if (isReminder) {
          var oldNotes = String(data[i][cNotes] || "");
          sheet.getRange(rowNum, cNotes + 1).setValue(oldNotes + " [REMINDED BY RM: " + nowStr + "]");
          sheet.getRange(rowNum, cUpdated + 1).setValue(nowStr);
          return { success: true, message: "Pengingat berhasil dikirim ke Store Manager!" };
        } else {
          sheet.getRange(rowNum, cStatus + 1).setValue(newStatus);
          sheet.getRange(rowNum, cNotes + 1).setValue(subordinateNotes);
          sheet.getRange(rowNum, cUpdated + 1).setValue(nowStr);
          return { success: true, message: "Tindak lanjut berhasil disimpan!" };
        }
      }
    }
    return { success: false, message: "Tiket temuan tidak ditemukan" };
  } catch (err) {
    return { success: false, message: err.toString() };
  } finally {
    lock.releaseLock();
  }
}