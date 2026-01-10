/**
 * Quiz Module - Personality-Based Filter Generation
 * 5 questions that map personality traits to filter parameters
 */

const Quiz = (function() {
    const questions = [
        {
            id: 1,
            text: "You walk into a crowded room full of strangers. What is your immediate instinct?",
            subtext: "The Focus Question",
            options: [
                { 
                    icon: "🎤", 
                    label: "Step into the center and introduce myself", 
                    description: "Open and inviting", 
                    value: 1 
                },
                { 
                    icon: "👀", 
                    label: "Find a quiet corner and observe everything from a distance", 
                    description: "Private and thoughtful", 
                    value: 2 
                },
                { 
                    icon: "💬", 
                    label: "Find one interesting person and have a deep conversation", 
                    description: "Focused connection", 
                    value: 3 
                }
            ],
            affects: ["brightness", "vignette"]
        },
        {
            id: 2,
            text: "If you could live in any era, which would you choose?",
            subtext: "The Timeline Question",
            options: [
                { 
                    icon: "🚀", 
                    label: "A high-tech, efficient future", 
                    description: "Modern and clean", 
                    value: 1 
                },
                { 
                    icon: "📜", 
                    label: "The romantic, golden days of the past", 
                    description: "Nostalgic and warm", 
                    value: 2 
                },
                { 
                    icon: "🌍", 
                    label: "Right here, right now", 
                    description: "True to life", 
                    value: 3 
                }
            ],
            affects: ["temperature", "grain"]
        },
        {
            id: 3,
            text: "How do you prefer to solve a complex problem?",
            subtext: "The Clarity Question",
            options: [
                { 
                    icon: "📊", 
                    label: "With black-and-white facts and clear definitions", 
                    description: "Decisive and sharp", 
                    value: 1 
                },
                { 
                    icon: "🌫️", 
                    label: "By exploring the grey areas and nuances", 
                    description: "Soft and open", 
                    value: 2 
                },
                { 
                    icon: "✨", 
                    label: "By following my intuition until it feels right", 
                    description: "Artistic and creative", 
                    value: 3 
                }
            ],
            affects: ["contrast", "fade", "tint"]
        },
        {
            id: 4,
            text: "What is your ideal definition of a 'perfect' weekend?",
            subtext: "The Energy Question",
            options: [
                { 
                    icon: "🎉", 
                    label: "A loud music festival or a busy city adventure", 
                    description: "Colorful and energetic", 
                    value: 1 
                },
                { 
                    icon: "🏕️", 
                    label: "A quiet cabin in the woods with no phone signal", 
                    description: "Muted and calm", 
                    value: 2 
                },
                { 
                    icon: "🍷", 
                    label: "A dinner party with close friends", 
                    description: "Warm and balanced", 
                    value: 3 
                }
            ],
            affects: ["saturation"]
        },
        {
            id: 5,
            text: "Which of these abstract concepts appeals to you most?",
            subtext: "The Vibe Question",
            options: [
                { 
                    icon: "⚖️", 
                    label: "Truth and Honesty", 
                    description: "Unfiltered reality", 
                    value: 1 
                },
                { 
                    icon: "🔮", 
                    label: "Mystery and Dreams", 
                    description: "Ethereal and magical", 
                    value: 2 
                },
                { 
                    icon: "🏠", 
                    label: "Comfort and Safety", 
                    description: "Cozy and warm", 
                    value: 3 
                }
            ],
            affects: ["tint", "temperature"]
        }
    ];

    // State
    let currentQuestion = 0;
    let answers = new Array(questions.length).fill(null);
    let onCompleteCallback = null;
    let onQuestionChangeCallback = null;

    // DOM Elements
    let elements = {};

    /**
     * Initialize the quiz module
     */
    function init() {
        elements = {
            questionText: document.getElementById('question-text'),
            answersContainer: document.getElementById('answers-container'),
            progressFill: document.getElementById('progress-fill'),
            progressText: document.getElementById('progress-text'),
            prevBtn: document.getElementById('prev-btn'),
            nextBtn: document.getElementById('next-btn')
        };

        elements.prevBtn.addEventListener('click', goToPrevious);
        elements.nextBtn.addEventListener('click', goToNext);

        renderQuestion();
    }

    /**
     * Render the current question
     */
    function renderQuestion() {
        const question = questions[currentQuestion];
        
        // Update question text with animation
        elements.questionText.style.animation = 'none';
        elements.questionText.offsetHeight;
        elements.questionText.style.animation = 'fadeInUp 0.4s ease-out';
        
        // Build question HTML with subtext label
        let questionHTML = question.text;
        if (question.subtext) {
            questionHTML = `<span class="question-label">${question.subtext}</span>${question.text}`;
        }
        elements.questionText.innerHTML = questionHTML;

        // Update answers
        elements.answersContainer.innerHTML = '';
        elements.answersContainer.style.animation = 'none';
        elements.answersContainer.offsetHeight;
        elements.answersContainer.style.animation = 'fadeInUp 0.4s ease-out 0.1s both';

        question.options.forEach((option, index) => {
            const answerEl = document.createElement('div');
            answerEl.className = 'answer-option';
            if (answers[currentQuestion] === option.value) {
                answerEl.classList.add('selected');
            }
            
            answerEl.innerHTML = `
                <div class="answer-icon">${option.icon}</div>
                <div class="answer-content">
                    <div class="answer-label">${option.label}</div>
                    <div class="answer-description">${option.description}</div>
                </div>
            `;

            answerEl.addEventListener('click', () => selectAnswer(option.value, answerEl));
            elements.answersContainer.appendChild(answerEl);
        });

        updateProgress();
        updateNavigation();

        if (onQuestionChangeCallback) {
            onQuestionChangeCallback(currentQuestion, questions.length);
        }
    }

    /**
     * Select an answer for the current question
     */
    function selectAnswer(value, element) {
        answers[currentQuestion] = value;

        const allOptions = elements.answersContainer.querySelectorAll('.answer-option');
        allOptions.forEach(opt => opt.classList.remove('selected'));
        element.classList.add('selected');

        elements.nextBtn.disabled = false;

        // Auto-advance after short delay
        setTimeout(() => {
            if (currentQuestion < questions.length - 1) {
                goToNext();
            }
        }, 400);
    }

    /**
     * Update progress bar and text
     */
    function updateProgress() {
        const progress = ((currentQuestion + 1) / questions.length) * 100;
        elements.progressFill.style.width = `${progress}%`;
        elements.progressText.textContent = `${currentQuestion + 1} / ${questions.length}`;
    }

    /**
     * Update navigation button states
     */
    function updateNavigation() {
        elements.prevBtn.disabled = currentQuestion === 0;
        elements.nextBtn.disabled = answers[currentQuestion] === null;
        
        if (currentQuestion === questions.length - 1) {
            elements.nextBtn.innerHTML = `
                Finish
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
            `;
        } else {
            elements.nextBtn.innerHTML = `
                Next
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
            `;
        }
    }

    /**
     * Go to previous question
     */
    function goToPrevious() {
        if (currentQuestion > 0) {
            currentQuestion--;
            renderQuestion();
        }
    }

    /**
     * Go to next question or complete quiz
     */
    function goToNext() {
        if (answers[currentQuestion] === null) return;

        if (currentQuestion < questions.length - 1) {
            currentQuestion++;
            renderQuestion();
        } else {
            completeQuiz();
        }
    }

    /**
     * Complete the quiz and trigger callback
     */
    function completeQuiz() {
        const results = questions.map((q, i) => ({
            questionId: q.id,
            answer: answers[i],
            affects: q.affects
        }));

        if (onCompleteCallback) {
            onCompleteCallback(results);
        }
    }

    /**
     * Reset quiz to beginning
     */
    function reset() {
        currentQuestion = 0;
        answers = new Array(questions.length).fill(null);
        renderQuestion();
    }

    /**
     * Set callback for quiz completion
     */
    function onComplete(callback) {
        onCompleteCallback = callback;
    }

    /**
     * Set callback for question changes
     */
    function onQuestionChange(callback) {
        onQuestionChangeCallback = callback;
    }

    /**
     * Get current answers
     */
    function getAnswers() {
        return [...answers];
    }

    /**
     * Get questions data
     */
    function getQuestions() {
        return questions;
    }

    // Public API
    return {
        init,
        reset,
        onComplete,
        onQuestionChange,
        getAnswers,
        getQuestions,
        goToPrevious,
        goToNext
    };
})();
