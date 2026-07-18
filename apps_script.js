/**
 * Google Apps Script - "מנוע הפיקדונות של נועה" (Noa AI Deposit Engine)
 * 
 * פונקציה זו סורקת את רשימת ההזמנות בגיליון "לוג_הזמנות_מערכת" ומבצעת בדיקה מול
 * גיליון "מילון_לוגיסטי" המכיל מפתחות מוצרים והאם נדרש עבורם פקדון.
 * התוצאה נרשמת לעמודה K (מסקנות נועה AI) במהירות גבוהה באמצעות Map ואופטימיזציה של פניות לשרת.
 * 
 * --- הוראות התקנה ---
 * 1. בתוך גיליון ה-Google Sheets שלך, לחץ על Extensions (הרחבות) -> Apps Script.
 * 2. מחק את כל הקוד הקיים ב-Code.gs והדבק את הקוד הבא.
 * 3. לחץ על כפתור השמירה (אייקון דיסקט).
 * 4. תוכל להריץ את הפונקציה analyzeDepositsAndWriteConclusions ידנית, או להגדיר לה Trigger (טריגר) יומי/בעת עריכה.
 */

function analyzeDepositsAndWriteConclusions() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const orderSheet = ss.getSheetByName("לוג_הזמנות_מערכת");
  const dictSheet = ss.getSheetByName("מילון_לוגיסטי");
  
  if (!orderSheet) {
    Logger.log("שגיאה: לא נמצא גיליון בשם 'לוג_הזמנות_מערכת'");
    return;
  }
  if (!dictSheet) {
    Logger.log("שגיאה: לא נמצא גיליון בשם 'מילון_לוגיסטי'");
    return;
  }
  
  // 1. טעינת המילון למפתחות (Performance Optimization)
  const dictData = dictSheet.getDataRange().getValues();
  const dictMap = new Map();
  dictData.forEach(row => {
    if (row[0]) {
      dictMap.set(row[0].toString().trim(), row[1] ? row[1].toString().trim() : "");
    }
  });
  
  // 2. קריאת ההזמנות
  const data = orderSheet.getDataRange().getValues();
  if (data.length <= 1) {
    Logger.log("אין מספיק נתונים לניתוח.");
    return;
  }
  
  const conclusions = []; // עמודה K היא אינדקס 10 (עמודה מספר 11)
  
  for (let i = 1; i < data.length; i++) {
    const items = data[i][5] ? data[i][5].toString() : ""; // עמודה F (פריטים) - אינדקס 5
    let hasDeposit = false;
    let foundDepositItems = [];
    
    // בדיקה מהירה אם פריט מההזמנה קיים במילון כבעל פקדון
    for (let [item, status] of dictMap) {
      if (items.includes(item) && status === "פקדון") {
        hasDeposit = true;
        foundDepositItems.push(item);
      }
    }
    
    if (hasDeposit) {
      conclusions.push([`⚠️ נדרש פקדון עבור פריטים: ${foundDepositItems.join(", ")}`]);
    } else {
      conclusions.push(["✅ הזמנה תקינה ללא דרישת פקדון"]);
    }
  }
  
  // 3. כתיבה מהירה לעמודה K (אינדקס 11 בגיליון, שורות 2 עד הסוף)
  orderSheet.getRange(2, 11, conclusions.length, 1).setValues(conclusions);
  Logger.log(`סיימנו! עודכנו ${conclusions.length} שורות בעמודת מסקנות נועה AI.`);
}
