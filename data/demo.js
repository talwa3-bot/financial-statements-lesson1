/*
  data/demo.js
  קובץ נתונים דמה קטן לבדיקת engine.js.
  לא נטען אוטומטית ב-index.html - משמש רק את demo.html לבדיקה.
*/

window.DEMO_GAME_DATA = {
  title: "משחק דמו - זוגי או אי-זוגי",
  subtitle: "בדיקת מנוע המשחקים",
  mode: "classify",
  categories: [
    { id: "even", label: "זוגי" },
    { id: "odd", label: "אי-זוגי" }
  ],
  rounds: [
    {
      level: 1,
      items: [
        { id: "n1", text: "4", answer: "even", explain: "4 מתחלק ב-2 ללא שארית, לכן הוא זוגי." },
        { id: "n2", text: "7", answer: "odd", explain: "7 לא מתחלק ב-2 ללא שארית, לכן הוא אי-זוגי." },
        { id: "n3", text: "10", answer: "even", explain: "10 מתחלק ב-2 ללא שארית, לכן הוא זוגי." },
        { id: "n4", text: "3", answer: "odd", explain: "3 לא מתחלק ב-2 ללא שארית, לכן הוא אי-זוגי." }
      ]
    },
    {
      level: 2,
      items: [
        { id: "n5", text: "15", answer: "odd", explain: "15 לא מתחלק ב-2 ללא שארית, לכן הוא אי-זוגי." },
        { id: "n6", text: "22", answer: "even", explain: "22 מתחלק ב-2 ללא שארית, לכן הוא זוגי." },
        { id: "n7", text: "9", answer: "odd", explain: "9 לא מתחלק ב-2 ללא שארית, לכן הוא אי-זוגי." }
      ]
    }
  ],
  homework: {
    intro: "כתבו שלושה מספרים זוגיים ושלושה מספרים אי-זוגיים, והסבירו איך ידעתם.",
    items: [
      "שלושה מספרים זוגיים:",
      "שלושה מספרים אי-זוגיים:",
      "איך יודעים אם מספר הוא זוגי או אי-זוגי?"
    ]
  }
};
