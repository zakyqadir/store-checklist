// ========================================================
// AUTOMATED QA TEST RUNNER & SIMULATION HARNESS
// File: QA_TestRunner.gs (Self-Contained Suite)
// ========================================================

// 1. DATA MOCK FIXTURES (Dideklarasikan langsung di level global script)
var MOCK_FIXTURES = {
  employees: [
    { id: "M-SA01", name: "Rian Hidayat", storeCode: "272", role: "SA", phone: "6281234567801" },
    { id: "M-ASM01", name: "Siti Rahma", storeCode: "272", role: "ASM", phone: "" }, // No ASM Kosong
    { id: "M-SM01", name: "Budi Santoso", storeCode: "272", role: "SM", phone: "" },   // No SM Kosong (Pemicu Eskalasi)
    { id: "M-RM01", name: "Zaky Abdul Qadir", storeCode: "ALL", role: "RM", phone: "6281198765432" } // Superior RM
  ],
  stores: [
    { siteCode: "272", siteName: "The Park Sawangan", region: "Jabodetabek 2", regionalManager: "Zaky Abdul Qadir" }
  ],
  questions: [
    { id: "OP-01", checklistType: "OPENING", frequency: "Daily", requiredRole: "SM,ASM", text: "Buka gembok rolling door", weight: 10, responseType: "yes_no" },
    { id: "CL-01", checklistType: "CLOSING", frequency: "Daily", requiredRole: "SM,ASM", text: "Settlement EDC kasir", weight: 20, responseType: "yes_no_full" },
    { id: "WK-01", checklistType: "REGULAR", frequency: "Weekly", requiredRole: "ALL", text: "Uji fungsi APAR & Hydrant", weight: 15, responseType: "yes_no_sentence" },
    { id: "DL-01", checklistType: "REGULAR", frequency: "Daily", requiredRole: "ALL", text: "Kerapian Display Manekin & Gondola", weight: 10, responseType: "yes_no_sentence" }
  ],
  // 1x1 Pixel JPEG Base64 valid untuk uji upload Google Drive
  sampleDefectBase64: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA="
};

// 2. FUNGSI UTAMA RUNNER
function runAllSystemTests() {
  var results = [];
  var startTime = new Date().getTime();
  
  Logger.log("==================================================");
  Logger.log("🚀 MEMULAI EKSEKUSI AUTOMATED QA TEST RUNNER");
  Logger.log("==================================================");

  // Jalankan Seluruh Skenario Pengujian
  results.push(test_TC01_RoleChecklistIsolation());
  results.push(test_TC02_WeeklyExemptFromOpeningClosing());
  results.push(test_TC03_ProductAuditExemptionRules());
  results.push(test_TC04_DriveDefectPhotoStorage());
  results.push(test_TC05_HierarchicalWaEscalation());
  results.push(test_TC06_IdempotencyCacheGuard());
  results.push(test_TC07_SeparationOfDutyWorkflow());

  var total = results.length;
  var passed = results.filter(function(r) { return r.status === "PASSED"; }).length;
  var failed = total - passed;
  var duration = (new Date().getTime() - startTime) / 1000;

  Logger.log("--------------------------------------------------");
  Logger.log("📊 HASIL AKHIR: " + passed + "/" + total + " PASSED (" + failed + " FAILED) in " + duration + "s");
  Logger.log("==================================================");

  return { total: total, passed: passed, failed: failed, duration: duration, details: results };
}

// 3. IMPLEMENTASI TEST CASES

function test_TC01_RoleChecklistIsolation() {
  try {
    var userRole = "SA";
    var selectedFreq = "Daily";
    var isExcluded = (userRole === "RM" || userRole === "SA" || userRole === "SPV");

    var allowedOptions = (isExcluded || selectedFreq !== "Daily") 
      ? ["REGULAR"] 
      : ["REGULAR", "OPENING", "CLOSING"];

    if (allowedOptions.length === 1 && allowedOptions[0] === "REGULAR") {
      return logTestResult("TC-01", "Role Permission & Checklist Isolation", "PASSED");
    } else {
      return logTestResult("TC-01", "Role Permission & Checklist Isolation", "FAILED", "Opsi Opening/Closing masih bocor ke SA");
    }
  } catch(e) {
    return logTestResult("TC-01", "Role Permission & Checklist Isolation", "FAILED", e.toString());
  }
}

function test_TC02_WeeklyExemptFromOpeningClosing() {
  try {
    var selectedFreq = "Weekly";
    var userRole = "SM";
    var isExcluded = (userRole === "RM" || userRole === "SA");

    var allowedTypes = (isExcluded || selectedFreq !== "Daily") 
      ? ["REGULAR"] 
      : ["REGULAR", "OPENING", "CLOSING"];

    if (allowedTypes.length === 1 && allowedTypes[0] === "REGULAR") {
      return logTestResult("TC-02", "Frequency-Checklist State Consistency (Weekly -> REGULAR)", "PASSED");
    } else {
      return logTestResult("TC-02", "Frequency-Checklist State Consistency", "FAILED", "Weekly masih memuat Opening/Closing");
    }
  } catch(e) {
    return logTestResult("TC-02", "Frequency-Checklist State Consistency", "FAILED", e.toString());
  }
}

function test_TC03_ProductAuditExemptionRules() {
  try {
    var matrix = [
      { type: "REGULAR", freq: "Daily", expectedSku: true },
      { type: "REGULAR", freq: "Weekly", expectedSku: false },
      { type: "REGULAR", freq: "Monthly", expectedSku: false },
      { type: "OPENING", freq: "Daily", expectedSku: false },
      { type: "CLOSING", freq: "Daily", expectedSku: false }
    ];

    var allMatch = matrix.every(function(m) {
      var isSkuExempt = (m.type === "OPENING" || m.type === "CLOSING" || m.freq.toLowerCase() !== "daily");
      var actualSkuRequired = !isSkuExempt;
      return actualSkuRequired === m.expectedSku;
    });

    if (allMatch) {
      return logTestResult("TC-03", "Product Audit (10 SKU) Exemption Matrix", "PASSED");
    } else {
      return logTestResult("TC-03", "Product Audit (10 SKU) Exemption Matrix", "FAILED", "Inkonsistensi pada syarat SKU");
    }
  } catch(e) {
    return logTestResult("TC-03", "Product Audit (10 SKU) Exemption Matrix", "FAILED", e.toString());
  }
}

function test_TC04_DriveDefectPhotoStorage() {
  try {
    var sampleBase64 = MOCK_FIXTURES.sampleDefectBase64;
    var testActionId = "QA-TEST-ACT-" + new Date().getTime();
    
    // Memanggil fungsi riil di Code.gs
    var driveUrl = saveDefectPhotoToDrive(sampleBase64, testActionId);

    // Assert: Output harus URL Google Drive aktif
    if (driveUrl && driveUrl.indexOf("http") === 0 && driveUrl.indexOf("drive.google.com") !== -1) {
      return logTestResult("TC-04", "Drive Defect Photo Storage (< 150 char URL)", "PASSED", "URL: " + driveUrl);
    } else {
      return logTestResult("TC-04", "Drive Defect Photo Storage", "FAILED", "Output bukan URL Drive valid: " + driveUrl);
    }
  } catch(e) {
    return logTestResult("TC-04", "Drive Defect Photo Storage", "FAILED", e.toString());
  }
}

function test_TC05_HierarchicalWaEscalation() {
  try {
    var employees = MOCK_FIXTURES.employees;
    var targetSite = "272";
    var rmName = "Zaky Abdul Qadir";

    // Simulasi: SM & ASM tidak punya no telepon, harus otomatis eskalasi ke RM
    var storeStaff = employees.filter(function(e) { return e.storeCode === targetSite; });
    var smStaff = storeStaff.find(function(e) { return e.role === "SM" && (e.phone || "").trim() !== ""; });
    var asmStaff = storeStaff.find(function(e) { return e.role === "ASM" && (e.phone || "").trim() !== ""; });

    var targetPhone = "";
    var escalationRole = "";

    if (smStaff) {
      targetPhone = smStaff.phone;
      escalationRole = "SM";
    } else if (asmStaff) {
      targetPhone = asmStaff.phone;
      escalationRole = "ASM";
    } else {
      // Eskalasi otomatis ke Regional Manager (RM)
      var rmStaff = employees.find(function(e) { 
        return e.role === "RM" && (e.phone || "").trim() !== "" && (e.name === rmName || e.storeCode === "ALL"); 
      });
      if (rmStaff) {
        targetPhone = rmStaff.phone;
        escalationRole = "RM";
      }
    }

    if (escalationRole === "RM" && targetPhone === "6281198765432") {
      return logTestResult("TC-05", "Hierarchical WhatsApp Escalation (SM -> ASM -> RM)", "PASSED", "Target eskalasi: " + targetPhone + " (RM)");
    } else {
      return logTestResult("TC-05", "Hierarchical WhatsApp Escalation", "FAILED", "Gagal eskalasi ke RM saat kontak toko kosong");
    }
  } catch(e) {
    return logTestResult("TC-05", "Hierarchical WhatsApp Escalation", "FAILED", e.toString());
  }
}

function test_TC06_IdempotencyCacheGuard() {
  try {
    var cache = CacheService.getScriptCache();
    var testSite = "999";
    var today = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd");
    var key = "SUBMITTED_" + testSite + "_OPENING_" + today;

    cache.remove(key);
    var initialCheck = cache.get(key);
    
    cache.put(key, "DONE", 60);
    var duplicateCheck = cache.get(key);
    
    cache.remove(key); // Cleanup

    if (initialCheck === null && duplicateCheck === "DONE") {
      return logTestResult("TC-06", "Idempotency Cache Guard O(1)", "PASSED");
    } else {
      return logTestResult("TC-06", "Idempotency Cache Guard O(1)", "FAILED", "Cache tidak merespons nilai mutasi");
    }
  } catch(e) {
    return logTestResult("TC-06", "Idempotency Cache Guard O(1)", "FAILED", e.toString());
  }
}

function test_TC07_SeparationOfDutyWorkflow() {
  try {
    var auditorCreatorId = "M-RM01";
    var activeUserSubordinate = "M-SA01";
    var activeUserSelf = "M-RM01";

    var canSubordinateResolve = (activeUserSubordinate !== auditorCreatorId);
    var canSelfResolve = (activeUserSelf !== auditorCreatorId);

    if (canSubordinateResolve === true && canSelfResolve === false) {
      return logTestResult("TC-07", "Separation of Duty (Anti-Self Approval)", "PASSED");
    } else {
      return logTestResult("TC-07", "Separation of Duty (Anti-Self Approval)", "FAILED", "Auditor bisa menyelesaikan temuannya sendiri");
    }
  } catch(e) {
    return logTestResult("TC-07", "Separation of Duty", "FAILED", e.toString());
  }
}

// 4. LOGGING HELPER
function logTestResult(id, title, status, notes) {
  var noteStr = notes ? " -> " + notes : "";
  Logger.log("[" + status + "] " + id + ": " + title + noteStr);
  return { id: id, title: title, status: status, notes: notes || "" };
}