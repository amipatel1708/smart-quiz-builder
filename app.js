let quizzes = JSON.parse(localStorage.getItem("quizzes")) || [];
let currentQuizId = quizzes[0]?.id || null;
let answers = [];
let editIndex = null;
let currentIndex = 0;
let score = 0;
let selected = null;
let timerInterval = null;
let timeLeft = 0;

const quizSection = document.getElementById("page-play");
const resultSection = document.getElementById("page-results");
const timerEl = document.getElementById("timer");

function saveData() {
    localStorage.setItem("quizzes", JSON.stringify(quizzes));
}

function getQuiz() {
    return quizzes.find(q => q.id === currentQuizId);
}

// QUIZ MANAGEMENT
function createQuiz() {
    const title = quizTitle.value.trim();
    if (!title) return alert("Quiz name required");
    quizzes.push({
        id: Date.now(),
        title,
        timePerQuestion: 600,
        questions: [],
        attempts: []
    });
    currentQuizId = quizzes.at(-1).id;
    quizTitle.value = "";
    saveData();
    renderQuizSelect();
    updatePlayButtonState();
    renderDashboardStats();
}

function renderQuizSelect() {
    quizSelect.innerHTML = `
        <option value="" selected disabled hidden>
            — Select a Quiz —
        </option>
    `;
    quizzes.forEach(q => {
        const opt = document.createElement("option");
        opt.value = q.id;
        opt.textContent = q.title;
        quizSelect.appendChild(opt);
    });
    currentQuizId = null;
    updatePlayButtonState();
}

function switchQuiz() {
    if (!quizSelect.value) {
        currentQuizId = null;
        renderQuestions();
        updatePlayButtonState();
        renderDashboardStats();
        return;
    }
    currentQuizId = Number(quizSelect.value);
    renderQuestions();
    renderAttempts();
    renderAnalytics();
    updatePlayButtonState();
    renderDashboardStats();
}

function updatePlayButtonState() {
    const playBtn = document.getElementById("playBtn");
    const deleteBtn = document.getElementById("deleteQuizBtn");
    const quiz = getQuiz();
    const hasValidQuiz =quiz && quiz.questions && quiz.questions.length >= 0;
    playBtn.disabled = !(quiz && quiz.questions.length > 0);
    playBtn.textContent = playBtn.disabled
        ? "Create or Select a Quiz"
        : "▶ Play Quiz";
    if (deleteBtn) {
        deleteBtn.disabled = !quiz;
        deleteBtn.title = quiz
            ? "Delete selected quiz"
            : "Select a quiz to delete";
    }
}

// QUESTIONS
function saveQuestion() {
    const quiz = getQuiz();
    const text = questionText.value.trim();
    const opts = [...document.querySelectorAll(".option")].map(o => o.value.trim());
    const correct = correctAnswer.value;
    if (!text || opts.some(o => !o) || correct === "") {
        alert("All fields required");
        return;
    }
    const q = { text, opts, correct: Number(correct) };
    if (editIndex !== null) {
        quiz.questions[editIndex] = q;
        editIndex = null;
    } else {
        quiz.questions.push(q);
    }
    clearForm();
    saveData();
    renderQuestions();
    updatePlayButtonState();
    renderDashboardStats();
}

function renderQuestions() {
    const quiz = getQuiz();
    questionList.innerHTML = "";
    if (!quiz || quiz.questions.length === 0) {
        questionList.innerHTML = `
            <li class="empty-state">Create a quiz first and add questions</li>
        `;
        return;
    }
    quiz.questions.forEach((q, i) => {
        const li = document.createElement("li");
        li.innerHTML = `
            <span><strong>${i + 1}.</strong> ${q.text}</span>
            <div class="actions">
                <button class="btn-edit" onclick="editQuestion(${i})">Edit</button>
                <button class="btn-delete" onclick="deleteQuestion(${i})">Delete</button>
            </div>
        `;
        questionList.appendChild(li);
    });
}

function editQuestion(i) {
    const q = getQuiz().questions[i];
    questionText.value = q.text;
    document.querySelectorAll(".option").forEach((o, x) => {
        o.value = q.opts[x];
    });
    correctAnswer.value = q.correct;
    editIndex = i;
    const card = questionText.closest(".card");
    card.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });
    card.classList.remove("focus-card");
    void card.offsetWidth;
    card.classList.add("focus-card");
    document.getElementById("btn").innerText = "Update Question";
}

function deleteQuestion(i) {
    getQuiz().questions.splice(i, 1);
    saveData();
    renderQuestions();
    renderDashboardStats();
}

// GLOBAL DASHBOARD STATS
function renderDashboardStats() {
    const totalQuizzesEl = document.getElementById("statQuizzes");
    const totalQuestionsEl = document.getElementById("statQuestions");
    const totalAttemptsEl = document.getElementById("statAttempts");
    const avgScoreEl = document.getElementById("statAvg");
    const totalQuizzes = quizzes.length;
    const totalQuestions = quizzes.reduce((sum, q) => sum + (q.questions?.length || 0), 0);
    const totalAttempts = quizzes.reduce((sum, q) => sum + (q.attempts?.length || 0), 0);
    let overallAverage = 0;
    let totalScores = 0;
    quizzes.forEach(q => {
        q.attempts?.forEach(a => totalScores += a.percent);
    });
    if (totalAttempts > 0) {
        overallAverage = Math.round(totalScores / totalAttempts);
    }
    if (totalQuizzesEl) totalQuizzesEl.textContent = totalQuizzes;
    if (totalQuestionsEl) totalQuestionsEl.textContent = totalQuestions;
    if (totalAttemptsEl) totalAttemptsEl.textContent = totalAttempts;
    if (avgScoreEl) avgScoreEl.textContent = overallAverage + "%";
}

function startQuiz() {
    const quiz = getQuiz();
    if (!quiz || quiz.questions.length === 0) {
        alert("Please add at least one question.");
        return;
    }
    timeLeft = (Number(quizTime.value) || 10) * 60;
    quiz.timePerQuestion = timeLeft;
    currentIndex = 0;
    score = 0;
    answers = [];
    selected = null;
    showPage("play");
    startQuizTimer();
    showQuestion();
}

function deleteQuiz() {
    if (!currentQuizId) return;
    document.getElementById("confirmModal").classList.remove("hidden");
}

function closeConfirmModal() {
    document.getElementById("confirmModal").classList.add("hidden");
}

function confirmDeleteQuiz() {
    currentQuizId = Number(currentQuizId);
    quizzes = quizzes.filter(q => q.id !== currentQuizId);
    currentQuizId = quizzes[0]?.id || null;
    saveData();
    renderQuizSelect();
    closeConfirmModal();
    updatePlayButtonState();
    renderDashboardStats();
}

// TIMER (RED WARNING)
function startQuizTimer() {
    clearInterval(timerInterval);
    updateTimerUI();
    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerUI();
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            finishQuiz();
        }
    }, 1000);
}

function updateTimerUI() {
    const min = Math.floor(timeLeft / 60);
    const sec = timeLeft % 60;
    timerEl.textContent =
        `⏱ ${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    if (timeLeft <= 60) {
        timerEl.classList.add("danger-timer");
    } else {
        timerEl.classList.remove("danger-timer");
    }
}

// QUESTIONS FLOW
function showQuestion() {
    selected = null;
    const quiz = getQuiz();
    const q = quiz.questions[currentIndex];
    quizQuestion.textContent = `Q${currentIndex + 1}. ${q.text}`;
    quizOptions.innerHTML = "";
    q.opts.forEach((opt, i) => {
        const btn = document.createElement("button");
        btn.textContent = opt;
        btn.className = "quiz-option";
        btn.onclick = () => {
            selected = i;
            document.querySelectorAll(".quiz-option")
                .forEach(b => b.classList.remove("selected"));
            btn.classList.add("selected");
        };
        quizOptions.appendChild(btn);
    });
    // NEXT / SUBMIT LOGIC
    const nextBtn = document.getElementById("nextBtn");
    if (currentIndex === quiz.questions.length - 1) {
        nextBtn.textContent = "Submit Quiz";
        nextBtn.classList.add("danger");
    } else {
        nextBtn.textContent = "Next";
        nextBtn.classList.remove("danger");
    }
}

function showCompleteModal() {
    document.getElementById("completeModal").classList.remove("hidden");
}

function closeCompleteModal() {
    document.getElementById("completeModal").classList.add("hidden");
    showPage("results");
}

function nextQuestion() {
    const quiz = getQuiz();
    const q = quiz.questions[currentIndex];

    answers.push(selected);
    if (selected === q.correct) score++;

    currentIndex++;

    if (currentIndex < quiz.questions.length) {
        showQuestion();
    } else {
        clearInterval(timerInterval);
        finishQuiz();
    }
}

// FINISH QUIZ
function finishQuiz() {
    const quiz = getQuiz();
    let correct = 0, wrong = 0, skipped = 0;
    answers.forEach((ans, i) => {
        if (ans === null) skipped++;
        else if (ans === quiz.questions[i].correct) correct++;
        else wrong++;
    });
    const percent = Math.round((correct / quiz.questions.length) * 100);
    quiz.attempts.unshift({
        date: new Date().toLocaleString(),
        score: correct,
        total: quiz.questions.length,
        percent,
        answers
    });
    summaryStats.innerHTML = `
        <p class="stat-success"><img src="icons/correct.png" alt="Timer" class="icon"/>Correct: <strong>${correct}</strong></p>
        <p class="stat-danger"><img src="icons/wrong.png" alt="Timer" class="icon"/>Wrong: <strong>${wrong}</strong></p>
        <p class="stat-warning"><img src="icons/skipped.png" alt="Timer" class="icon"/>Skipped: <strong>${skipped}</strong></p>
        <p class="stat-info"><img src="icons/score.png" alt="Timer" class="icon"/>Score: <strong>${percent}%</strong></p>
    `;
    renderQuestionReview();
    saveData();
    renderAttempts();
    renderAnalytics();
    showCompleteModal();
    renderDashboardStats();
}

// ATTEMPT HISTORY
function renderAttempts() {
    const quiz = getQuiz();
    attemptTable.innerHTML = "";
    if (!quiz || !quiz.attempts) return;
    quiz.attempts.forEach((a, i) => {
        let badge = "low";
        if (a.percent >= 80) badge = "high";
        else if (a.percent >= 50) badge = "mid";
        attemptTable.innerHTML += `
            <tr class="attempt ${badge}">
                <td>${quiz.attempts.length - i}</td>
                <td>${a.date}</td>
                <td>${a.score}/${a.total}</td>
                <td><strong>${a.percent}%</strong></td>
            </tr>
        `;
    });
}

// ANALYTICS
function renderAnalytics() {
    const quiz = getQuiz();
    const donut = document.querySelector(".donut");
    const answerDonut = document.getElementById("answerDonut");
    if (!quiz) {
        totalAttempts.textContent = "0";
        averageScore.textContent = "0";
        donutPercent.textContent = "0%";
        analyticsChart.innerHTML = "";
        if (donut) donut.style.setProperty("--percent", "0%");
        if (answerDonut) {
            answerDonut.style.setProperty("--c", "0%");
            answerDonut.style.setProperty("--w", "0%");
            answerDonut.style.setProperty("--s", "0%");
        }
        statCorrect.textContent = "0";
        statWrong.textContent = "0";
        statSkipped.textContent = "0";
        answerCenter.textContent = "—";
        return;
    }
    const attempts = quiz.attempts || [];
    totalAttempts.textContent = attempts.length;
    if (!attempts.length) {
        averageScore.textContent = "0";
        donutPercent.textContent = "0%";
        analyticsChart.innerHTML = "";
        if (donut) donut.style.setProperty("--percent", "0%");
        if (answerDonut) {
            answerDonut.style.setProperty("--c", "0%");
            answerDonut.style.setProperty("--w", "0%");
            answerDonut.style.setProperty("--s", "0%");
        }
        statCorrect.textContent = "0";
        statWrong.textContent = "0";
        statSkipped.textContent = "0";
        answerCenter.textContent = "0 Qs";
        return;
    }
    // Average score
    const avg = Math.round(
        attempts.reduce((sum, a) => sum + a.percent, 0) / attempts.length
    );
    averageScore.textContent = avg;
    donutPercent.textContent = avg + "%";
    if (donut) {
        donut.style.setProperty("--percent", avg + "%");
    }
    // Reset chart
    analyticsChart.innerHTML = "";
    // Breakdown counters 
    let totalCorrect = 0;
    let totalWrong = 0;
    let totalSkipped = 0;
    //  Question-wise accuracy 
    quiz.questions.forEach((q, i) => {
        let correct = 0;
        attempts.forEach(a => {
            const ans = a.answers[i];
            if (ans === null || ans === undefined) {
                totalSkipped++;
            } else if (ans === q.correct) {
                correct++;
                totalCorrect++;
            } else {
                totalWrong++;
            }
        });
        const accuracy = Math.round((correct / attempts.length) * 100);
        analyticsChart.innerHTML += `
            <div class="chart-row">
                <span>Q${i + 1}</span>
                <div class="progress">
                    <div class="progress-bar" style="width:${accuracy}%"></div>
                </div>
                <span>${accuracy}%</span>
            </div>
        `;
    });

    // Update breakdown numbers
    statCorrect.textContent = totalCorrect;
    statWrong.textContent = totalWrong;
    statSkipped.textContent = totalSkipped;
    const totalAnswers = totalCorrect + totalWrong + totalSkipped || 1;
    const cPercent = Math.round((totalCorrect / totalAnswers) * 100);
    const wPercent = Math.round((totalWrong / totalAnswers) * 100);
    const sPercent = Math.round((totalSkipped / totalAnswers) * 100);

    // Update breakdown donut
    if (answerDonut) {
        answerDonut.style.setProperty("--c", cPercent + "%");
        answerDonut.style.setProperty("--w", wPercent + "%");
        answerDonut.style.setProperty("--s", sPercent + "%");
    }
    answerCenter.textContent = totalAnswers + " Qs";
}

// REVIEW
function renderQuestionReview() {
    const quiz = getQuiz();
    questionReview.innerHTML = "";
    quiz.questions.forEach((q, i) => {
        let cls = "skipped";
        if (answers[i] === q.correct) cls = "correct";
        else if (answers[i] !== null) cls = "wrong";
        questionReview.innerHTML += `
            <div class="review ${cls}">
                <strong>Q${i + 1}:</strong> ${q.text}
            </div>
        `;
    });
}

// NAVIGATION 
function showPage(page) {
    // pages
    document.querySelectorAll(".page").forEach(p =>
        p.classList.remove("active")
    );
    document.getElementById("page-" + page).classList.add("active");
    // topbar buttons
    document.querySelectorAll(".nav button").forEach(btn => {
        btn.classList.remove("active");
        if (btn.dataset.page === page) {
            btn.classList.add("active");
        }
    });
}

// FORM RESET
function clearForm() {
    questionText.value = "";
    correctAnswer.value = "";
    document.querySelectorAll(".option").forEach(o => o.value = "");
}

// COMPLETE MODAL ACTION
let countdownInterval = null;
function goToResults() {
    clearInterval(countdownInterval);
    closeCompleteModal();
}

// AUTO COUNTDOWN (30s)
function showCompleteModal() {
    const modal = document.getElementById("completeModal");
    const countdownEl = document.getElementById("countdown");
    let seconds = 5;
    countdownEl.textContent = seconds;
    modal.classList.remove("hidden");
    countdownInterval = setInterval(() => {
        seconds--;
        countdownEl.textContent = seconds;
        if (seconds <= 0) {
            clearInterval(countdownInterval);
            closeCompleteModal();
        }
    }, 1000);
}

function closeCompleteModal() {
    document.getElementById("completeModal").classList.add("hidden");
    showPage("results");
}

// INIT
const playBtn = document.getElementById("playBtn");
if (playBtn) {
    playBtn.addEventListener("click", () => {
        if (playBtn.disabled) return;
        startQuiz();
    });
}
renderQuizSelect();
updatePlayButtonState();
renderDashboardStats();