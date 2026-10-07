/*
  engine.js
  מנוע גנרי למשחקי סיווג (classify) וסידור (order).
  חושף פונקציה גלובלית יחידה: initGame(GAME_DATA, containerId)
*/

(function () {
  "use strict";

  var SPEED_BONUS_MAX = 5;
  var SPEED_BONUS_WINDOW_MS = 15000;
  var POINTS_FIRST_TRY = 10;
  var POINTS_AFTER_MISTAKE = 4;
  var TOTAL_SCORE_KEY = "learnGames_totalScore";

  function initGame(GAME_DATA, containerId) {
    var container = document.getElementById(containerId);
    if (!container) {
      return;
    }

    var state = {
      data: GAME_DATA,
      roundIndex: 0,
      score: 0,
      wrongCounts: {}, // itemId -> number of wrong attempts (across the game)
      missedExplains: {}, // explainText -> number of wrong attempts
      selectedItemId: null,
      pile: [],
      placed: {}, // categoryId -> [texts]
      itemStartTimes: {}, // itemId -> timestamp
      lastFeedback: null,
      scoreSaved: false,
    };

    // סרגל ניווט קבוע - מאפשר לקפוץ למבחן או למשימת בית מכל מסך, בכל רגע.
    var contentEl = el("div", "screen-content");
    container.appendChild(buildPersistentNav());
    container.appendChild(contentEl);

    function buildPersistentNav() {
      var nav = el("div", "game-nav");

      if (state.data.exam) {
        var examBtn = el("button", "btn btn-secondary pressable");
        examBtn.textContent = "מבחן";
        examBtn.addEventListener("click", renderExamIntro);
        nav.appendChild(examBtn);
      }

      if (state.data.homework && state.data.homework.items && state.data.homework.items.length) {
        var hwBtn = el("button", "btn btn-secondary pressable");
        hwBtn.textContent = "משימת בית";
        hwBtn.addEventListener("click", renderHomework);
        nav.appendChild(hwBtn);
      }

      return nav;
    }

    renderOpening();

    // ----- מסך פתיחה -----
    function renderOpening() {
      clear();
      var screen = el("div", "screen");

      var h2 = el("h2");
      h2.textContent = state.data.title || "";
      screen.appendChild(h2);

      if (state.data.subtitle) {
        var sub = el("p", "screen-subtitle");
        sub.textContent = state.data.subtitle;
        screen.appendChild(sub);
      }

      var levelTag = el("span", "level-tag");
      var roundsCount = (state.data.rounds || []).length;
      levelTag.textContent = "סבבים: " + roundsCount;
      screen.appendChild(levelTag);
      screen.appendChild(el("br"));

      var startBtn = el("button", "btn btn-primary pressable");
      startBtn.textContent = "התחילו";
      startBtn.addEventListener("click", function () {
        startRound(0);
      });
      screen.appendChild(startBtn);

      contentEl.appendChild(screen);
    }

    // ----- ניהול סבב -----
    function startRound(index) {
      state.roundIndex = index;
      var round = state.data.rounds[index];
      state.pile = shuffle(round.items.slice());
      state.placed = {};
      state.selectedItemId = null;
      state.lastFeedback = null;
      var now = Date.now();
      round.items.forEach(function (item) {
        state.itemStartTimes[item.id] = now;
      });
      renderRound();
    }

    function getCurrentRound() {
      return state.data.rounds[state.roundIndex];
    }

    function getCategoriesForRound(round) {
      if (state.data.mode === "order") {
        return round.items.map(function (_, i) {
          var label = String(i + 1);
          return { id: label, label: label };
        });
      }
      return state.data.categories || [];
    }

    function renderRound() {
      clear();
      var round = getCurrentRound();
      var categories = getCategoriesForRound(round);

      var screen = el("div", "screen");
      screen.appendChild(buildProgressBar());

      var levelTag = el("span", "level-tag");
      levelTag.textContent = "סבב " + (state.roundIndex + 1) + " מתוך " + state.data.rounds.length;
      screen.appendChild(levelTag);

      var scoreLine = el("div", "score-line");
      scoreLine.textContent = "ניקוד: " + state.score;
      screen.appendChild(scoreLine);

      if (state.lastFeedback) {
        screen.appendChild(buildFeedbackBox(state.lastFeedback));
      }

      var categoriesWrap = el("div", "categories");
      categories.forEach(function (cat) {
        var catBtn = el("button", "category pressable");
        catBtn.textContent = cat.label;

        var placedTexts = state.placed[cat.id] || [];
        if (placedTexts.length) {
          var itemsLine = el("div", "category-items");
          itemsLine.textContent = placedTexts.join(", ");
          catBtn.appendChild(itemsLine);
        }

        catBtn.addEventListener("click", function () {
          attemptPlacement(cat.id);
        });
        categoriesWrap.appendChild(catBtn);
      });
      screen.appendChild(categoriesWrap);

      var pileWrap = el("div", "item-pile");
      state.pile.forEach(function (item) {
        var itemBtn = el("button", "item-card pressable");
        if (item.id === state.selectedItemId) {
          itemBtn.className += " selected";
        }
        itemBtn.textContent = item.text;
        itemBtn.addEventListener("click", function () {
          selectItem(item.id);
        });
        pileWrap.appendChild(itemBtn);
      });
      screen.appendChild(pileWrap);

      contentEl.appendChild(screen);
    }

    function selectItem(itemId) {
      state.selectedItemId = state.selectedItemId === itemId ? null : itemId;
      renderRound();
    }

    function attemptPlacement(categoryId) {
      if (!state.selectedItemId) {
        return;
      }
      var round = getCurrentRound();
      var item = round.items.filter(function (i) {
        return i.id === state.selectedItemId;
      })[0];
      if (!item) {
        return;
      }

      if (String(item.answer) === String(categoryId)) {
        onCorrect(item, categoryId);
      } else {
        onWrong(item);
      }
    }

    function onCorrect(item, categoryId) {
      var firstTry = !state.wrongCounts[item.id];
      var points = firstTry ? POINTS_FIRST_TRY : POINTS_AFTER_MISTAKE;
      if (firstTry) {
        points += speedBonus(state.itemStartTimes[item.id]);
      }
      state.score += points;

      state.placed[categoryId] = state.placed[categoryId] || [];
      state.placed[categoryId].push(item.text);

      state.pile = state.pile.filter(function (i) {
        return i.id !== item.id;
      });
      state.selectedItemId = null;
      state.lastFeedback = { type: "correct", points: points };

      if (state.pile.length === 0) {
        renderRound();
        window.setTimeout(finishRound, 500);
        return;
      }

      renderRound();
    }

    function onWrong(item) {
      state.wrongCounts[item.id] = (state.wrongCounts[item.id] || 0) + 1;
      state.missedExplains[item.explain] = (state.missedExplains[item.explain] || 0) + 1;
      state.selectedItemId = null;
      state.lastFeedback = { type: "wrong", explain: item.explain };
      renderRound();
    }

    function finishRound() {
      if (state.roundIndex >= state.data.rounds.length - 1) {
        renderEnd();
      } else {
        renderBetween();
      }
    }

    function speedBonus(startTime) {
      var elapsed = Date.now() - startTime;
      var ratio = 1 - elapsed / SPEED_BONUS_WINDOW_MS;
      var bonus = Math.round(SPEED_BONUS_MAX * ratio);
      return Math.max(0, Math.min(SPEED_BONUS_MAX, bonus));
    }

    function buildFeedbackBox(feedback) {
      if (feedback.type === "correct") {
        var okBox = el("div", "feedback-box correct");
        okBox.textContent = "נכון! קיבלת " + feedback.points + " נקודות.";
        return okBox;
      }
      var wrongBox = el("div", "feedback-box wrong");
      wrongBox.textContent = feedback.explain || "לא נכון, נסו שוב.";
      return wrongBox;
    }

    function buildProgressBar() {
      var totalRounds = state.data.rounds.length;
      var round = getCurrentRound();
      var totalItems = round.items.length;
      var doneItems = totalItems - state.pile.length;
      var roundProgress = totalItems ? doneItems / totalItems : 0;
      var overall = (state.roundIndex + roundProgress) / totalRounds;

      var track = el("div", "top-progress");
      var fill = el("div", "top-progress-fill");
      fill.style.width = Math.round(overall * 100) + "%";
      track.appendChild(fill);
      return track;
    }

    // ----- מסך ביניים -----
    function renderBetween() {
      clear();
      var screen = el("div", "screen");
      screen.appendChild(buildProgressBar());

      var h2 = el("h2");
      h2.textContent = "סבב " + (state.roundIndex + 1) + " הושלם!";
      screen.appendChild(h2);

      var scoreLine = el("div", "score-line");
      scoreLine.textContent = "ניקוד עד כה: " + state.score;
      screen.appendChild(scoreLine);

      var nextBtn = el("button", "btn btn-primary pressable");
      nextBtn.textContent = "לסבב הבא";
      nextBtn.addEventListener("click", function () {
        startRound(state.roundIndex + 1);
      });
      screen.appendChild(nextBtn);

      contentEl.appendChild(screen);
    }

    // ----- מסך סיום -----
    function renderEnd() {
      if (!state.scoreSaved) {
        saveCumulativeScore(state.score);
        state.scoreSaved = true;
      }

      clear();
      var screen = el("div", "screen");

      var h2 = el("h2");
      h2.textContent = "סיימתם את המשחק!";
      screen.appendChild(h2);

      var scoreLine = el("div", "score-line");
      scoreLine.textContent = "ניקוד סופי: " + state.score;
      screen.appendChild(scoreLine);

      var topMissed = Object.keys(state.missedExplains)
        .map(function (explain) {
          return { explain: explain, count: state.missedExplains[explain] };
        })
        .sort(function (a, b) {
          return b.count - a.count;
        })
        .slice(0, 3);

      if (topMissed.length) {
        var subtitle = el("p", "screen-subtitle");
        subtitle.textContent = "הדברים שהכי כדאי לחזור עליהם:";
        screen.appendChild(subtitle);

        var list = el("ul", "missed-list");
        topMissed.forEach(function (entry) {
          var li = el("li");
          li.textContent = entry.explain;
          list.appendChild(li);
        });
        screen.appendChild(list);
      }

      var actions = el("div", "screen-actions");

      var againBtn = el("button", "btn btn-secondary pressable");
      againBtn.textContent = "שחקו שוב";
      againBtn.addEventListener("click", function () {
        state.score = 0;
        state.wrongCounts = {};
        state.missedExplains = {};
        state.scoreSaved = false;
        startRound(0);
      });
      actions.appendChild(againBtn);

      if (state.data.homework && state.data.homework.items && state.data.homework.items.length) {
        var homeworkBtn = el("button", "btn btn-primary pressable");
        homeworkBtn.textContent = "למשימת הבית";
        homeworkBtn.addEventListener("click", renderHomework);
        actions.appendChild(homeworkBtn);
      }

      if (state.data.exam) {
        var examBtn = el("button", "btn btn-primary pressable");
        examBtn.textContent = "למבחן מסכם";
        examBtn.addEventListener("click", renderExamIntro);
        actions.appendChild(examBtn);
      }

      screen.appendChild(actions);
      contentEl.appendChild(screen);
    }

    function saveCumulativeScore(points) {
      try {
        var current = parseInt(localStorage.getItem(TOTAL_SCORE_KEY) || "0", 10);
        if (isNaN(current)) {
          current = 0;
        }
        localStorage.setItem(TOTAL_SCORE_KEY, String(current + points));
      } catch (e) {
        // localStorage לא זמין; מתעלמים בשקט
      }
    }

    // ----- מסך משימת בית -----
    function renderHomework() {
      clear();
      var homework = state.data.homework || { intro: "", items: [] };

      var screen = el("div", "screen");

      var h2 = el("h2");
      h2.textContent = "משימת בית";
      screen.appendChild(h2);

      if (homework.intro) {
        var intro = el("p", "screen-subtitle");
        intro.textContent = homework.intro;
        screen.appendChild(intro);
      }

      (homework.items || []).forEach(function (itemText, index) {
        var wrap = el("div", "homework-item");

        var label = el("p");
        label.textContent = itemText;
        wrap.appendChild(label);

        var textarea = el("textarea");
        textarea.id = "hw-answer-" + index;
        wrap.appendChild(textarea);

        var copyBtn = el("button", "copy-btn pressable");
        copyBtn.textContent = "העתקה ללוח";
        copyBtn.addEventListener("click", function () {
          copyToClipboard(textarea.value, copyBtn);
        });
        wrap.appendChild(copyBtn);

        screen.appendChild(wrap);
      });

      var backBtn = el("button", "btn btn-secondary pressable");
      backBtn.textContent = "חזרה למסך הסיום";
      backBtn.addEventListener("click", renderEnd);
      screen.appendChild(backBtn);

      contentEl.appendChild(screen);
    }

    function copyToClipboard(text, button) {
      var originalLabel = button.textContent;
      function onDone() {
        button.textContent = "הועתק!";
        window.setTimeout(function () {
          button.textContent = originalLabel;
        }, 1500);
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(onDone, function () {
          fallbackCopy(text);
          onDone();
        });
      } else {
        fallbackCopy(text);
        onDone();
      }
    }

    function fallbackCopy(text) {
      var textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand("copy");
      } catch (e) {
        // אין תמיכה בהעתקה; מתעלמים בשקט
      }
      document.body.removeChild(textarea);
    }

    // ----- מבחן מסכם (ללא משוב, ציון 1-100, שליחה לגיליון) -----
    function flattenAllItems() {
      var all = [];
      state.data.rounds.forEach(function (round) {
        round.items.forEach(function (item) {
          all.push(item);
        });
      });
      return all;
    }

    function renderExamIntro() {
      clear();
      var screen = el("div", "screen");

      var h2 = el("h2");
      h2.textContent = "מבחן מסכם";
      screen.appendChild(h2);

      var sub = el("p", "screen-subtitle");
      sub.textContent =
        "במבחן משבצים את כל הפריטים בלי משוב על נכון או שגוי. " +
        "בסיום תוכלו לבדוק את השיבוץ שלכם, תקבלו ציון, ותיפתח לשונית עם טופס קצר שבו ממלאים שם מלא ואימייל ולוחצים \"שליחה\" כדי שהציון יירשם.";
      screen.appendChild(sub);

      var startBtn = el("button", "btn btn-primary pressable");
      startBtn.textContent = "התחילו מבחן";
      startBtn.addEventListener("click", startExam);
      screen.appendChild(startBtn);

      contentEl.appendChild(screen);
    }

    function startExam() {
      state.examItems = flattenAllItems();
      state.examPile = shuffle(state.examItems.slice());
      state.examPlacements = {};
      state.examSelectedId = null;
      renderExam();
    }

    function renderExam() {
      clear();
      var screen = el("div", "screen");

      var h2 = el("h2");
      h2.textContent = "מבחן מסכם";
      screen.appendChild(h2);

      var placedCount = Object.keys(state.examPlacements).length;
      var counter = el("div", "score-line");
      counter.textContent = "שובצו " + placedCount + " מתוך " + state.examItems.length;
      screen.appendChild(counter);

      var categoriesWrap = el("div", "categories");
      (state.data.categories || []).forEach(function (cat) {
        var catBtn = el("button", "category pressable");
        catBtn.textContent = cat.label;

        var placedIds = Object.keys(state.examPlacements).filter(function (id) {
          return state.examPlacements[id] === cat.id;
        });

        if (placedIds.length) {
          var itemsLine = el("div", "exam-placed-items");
          placedIds.forEach(function (id) {
            var placedItem = state.examItems.filter(function (i) {
              return i.id === id;
            })[0];
            var chip = el("span", "item-card exam-chip pressable");
            chip.textContent = placedItem.text;
            chip.addEventListener("click", function (e) {
              e.stopPropagation();
              delete state.examPlacements[id];
              renderExam();
            });
            itemsLine.appendChild(chip);
          });
          catBtn.appendChild(itemsLine);
        }

        catBtn.addEventListener("click", function () {
          attemptExamPlacement(cat.id);
        });
        categoriesWrap.appendChild(catBtn);
      });
      screen.appendChild(categoriesWrap);

      var pileWrap = el("div", "item-pile");
      state.examPile.forEach(function (item) {
        if (state.examPlacements[item.id]) {
          return;
        }
        var itemBtn = el("button", "item-card pressable");
        if (item.id === state.examSelectedId) {
          itemBtn.className += " selected";
        }
        itemBtn.textContent = item.text;
        itemBtn.addEventListener("click", function () {
          state.examSelectedId = state.examSelectedId === item.id ? null : item.id;
          renderExam();
        });
        pileWrap.appendChild(itemBtn);
      });
      screen.appendChild(pileWrap);

      var reviewBtn = el("button", "btn btn-primary pressable");
      reviewBtn.textContent = "לבדיקה ולשליחה";
      if (placedCount < state.examItems.length) {
        reviewBtn.disabled = true;
      } else {
        reviewBtn.addEventListener("click", renderExamReview);
      }
      screen.appendChild(reviewBtn);

      contentEl.appendChild(screen);
    }

    function attemptExamPlacement(categoryId) {
      if (!state.examSelectedId) {
        return;
      }
      state.examPlacements[state.examSelectedId] = categoryId;
      state.examSelectedId = null;
      renderExam();
    }

    function renderExamReview() {
      clear();
      var screen = el("div", "screen");

      var h2 = el("h2");
      h2.textContent = "בדיקה לפני שליחה";
      screen.appendChild(h2);

      var sub = el("p", "screen-subtitle");
      sub.textContent = "אלו השיבוצים שבחרתם. השליחה סופית ולא ניתן לשנות אחריה.";
      screen.appendChild(sub);

      var categoriesById = {};
      (state.data.categories || []).forEach(function (cat) {
        categoriesById[cat.id] = cat.label;
      });

      var list = el("ul", "missed-list");
      state.examItems.forEach(function (item) {
        var li = el("li");
        var catLabel = categoriesById[state.examPlacements[item.id]] || "לא שובץ";
        li.textContent = item.text + " ← " + catLabel;
        list.appendChild(li);
      });
      screen.appendChild(list);

      var actions = el("div", "screen-actions");

      var backBtn = el("button", "btn btn-secondary pressable");
      backBtn.textContent = "חזרה לעריכה";
      backBtn.addEventListener("click", renderExam);
      actions.appendChild(backBtn);

      var submitBtn = el("button", "btn btn-primary pressable");
      submitBtn.textContent = "שליחה סופית";
      submitBtn.addEventListener("click", finalizeExam);
      actions.appendChild(submitBtn);

      screen.appendChild(actions);
      contentEl.appendChild(screen);
    }

    function finalizeExam() {
      var correct = 0;
      state.examItems.forEach(function (item) {
        if (String(state.examPlacements[item.id]) === String(item.answer)) {
          correct++;
        }
      });
      var scorePercent = Math.round((correct / state.examItems.length) * 100);
      var submitResult = submitExamScore(scorePercent);
      renderExamResult(scorePercent, submitResult);
    }

    function submitExamScore(score) {
      var formConfig = state.data.exam && state.data.exam.formSubmit;
      if (!formConfig || !formConfig.viewUrl || !formConfig.fields) {
        return { attempted: false, reason: "no-config" };
      }
      try {
        var url = buildPrefilledFormUrl(formConfig, score);
        window.open(url, "_blank");
        return { attempted: true, url: url };
      } catch (e) {
        return { attempted: false, reason: "error" };
      }
    }

    function buildPrefilledFormUrl(formConfig, score) {
      // פותחים את הטופס האמיתי של Google עם משחק+ציון ממולאים מראש (usp=pp_url).
      // שם ואימייל נשארים ריקים בכוונה - התלמיד ממלא אותם פעם אחת, בטופס עצמו,
      // ולא גם באתר וגם בטופס.
      var values = {
        game: state.data.title,
        score: String(score)
      };

      var params = ["usp=pp_url"];
      Object.keys(formConfig.fields).forEach(function (key) {
        if (values[key] === undefined) {
          return;
        }
        params.push(formConfig.fields[key] + "=" + encodeURIComponent(values[key]));
      });

      return formConfig.viewUrl + "?" + params.join("&");
    }

    function renderExamResult(score, submitResult) {
      clear();
      var screen = el("div", "screen");

      var h2 = el("h2");
      h2.textContent = "הציון שלך במבחן";
      screen.appendChild(h2);

      var scoreLine = el("div", "score-line");
      scoreLine.textContent = score + " / 100";
      screen.appendChild(scoreLine);

      var note = el("p", "screen-subtitle");
      if (submitResult && submitResult.attempted) {
        note.textContent =
          "נפתחה לשונית חדשה עם טופס שבו הציון כבר ממולא מראש. " +
          "מלאו שם מלא ואימייל בטופס עצמו ולחצו \"שליחה\" כדי שהציון יירשם ברשימת הכיתה.";
        screen.appendChild(note);

        if (submitResult.url) {
          var manualLink = el("a", "btn btn-secondary pressable");
          manualLink.textContent = "הלשונית לא נפתחה? לחצו כאן";
          manualLink.href = submitResult.url;
          manualLink.target = "_blank";
          manualLink.rel = "noopener";
          screen.appendChild(manualLink);
        }
      } else {
        note.textContent = "הציון לא נשלח לשום מקום - לא הוגדרה כתובת שליחה למבחן הזה.";
        screen.appendChild(note);
      }

      contentEl.appendChild(screen);
    }

    // ----- עזרים -----
    function clear() {
      contentEl.innerHTML = "";
    }

    function el(tag, className) {
      var node = document.createElement(tag);
      if (className) {
        node.className = className;
      }
      return node;
    }

    function shuffle(arr) {
      for (var i = arr.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
      }
      return arr;
    }
  }

  window.initGame = initGame;
})();
