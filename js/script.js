// --- CONFIGURAÇÃO ---
const GOOGLE_SHEET_URL_DADOS = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTdIx_PPpsql2PJ2P4iAwf0TmSdAK9EONsK4LKpgulQ0HoKJTX1ntVdXrqJsDcsGB4hJCOol0bj6QCb/pub?gid=0&single=true&output=csv';
const GOOGLE_SHEET_URL_CURSOS = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTdIx_PPpsql2PJ2P4iAwf0TmSdAK9EONsK4LKpgulQ0HoKJTX1ntVdXrqJsDcsGB4hJCOol0bj6QCb/pub?gid=653257983&single=true&output=csv';
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwpljaG7Hk6dcbYP-G0MjqJ7wGKBiztL4rYhTviISeqTTNi8yAKenJ35sODgYn-L3ZejQ/exec';
const FOTO_PADRAO_URL = 'https://i.imgur.com/3c8l2K6.png';

// --- ELEMENTOS DO DOM ---
const loginContainer = document.getElementById('login-container');
const passwordSetupContainer = document.getElementById('password-setup-container');
const dashboardLayout = document.getElementById('dashboard-layout');
const loginForm = document.getElementById('login-form');
const studentIdInput = document.getElementById('student-id');
const passwordInput = document.getElementById('password');
const loginErrorMessage = document.getElementById('login-error-message');
const loginButton = loginForm.querySelector('button[type="submit"]');
const passwordSetupForm = document.getElementById('password-setup-form');
const newPasswordInput = document.getElementById('new-password');
const confirmPasswordInput = document.getElementById('confirm-password');
const passwordErrorMessage = document.getElementById('password-error-message');
const passwordSetupButton = passwordSetupForm.querySelector('button[type="submit"]');
let currentStudentId = null;
const sidebar = document.getElementById('sidebar');
const menuToggle = document.getElementById('menu-toggle');
const overlay = document.getElementById('overlay');
const sidebarToggle = document.getElementById('sidebar-toggle');
const topbarStudentName = document.getElementById('topbar-student-name');
const topbarStudentPhoto = document.getElementById('topbar-student-photo');
const topbarStudentCourse = document.getElementById('topbar-student-course');
const topbarStudentClassProf = document.getElementById('topbar-student-class-prof');
const topbarStudentClassFH = document.getElementById('topbar-student-class-fh');
const allContentSections = document.querySelectorAll('.main-content-section');

const navLinks = {
    dashboard: { btn: document.getElementById('nav-dashboard'), section: document.getElementById('dashboard-section') },
    grades: { btn: document.getElementById('nav-grades'), section: document.getElementById('grades-section') },
    frequency: { btn: document.getElementById('nav-frequency'), section: document.getElementById('frequency-section') },
    ranking: { btn: document.getElementById('nav-ranking'), section: document.getElementById('ranking-section') },
    feedbacks: { btn: document.getElementById('nav-feedbacks'), section: document.getElementById('feedbacks-section') },
    ticket: { btn: document.getElementById('nav-ticket'), section: document.getElementById('ticket-section') },
    profile: { btn: document.getElementById('nav-profile'), section: document.getElementById('profile-section') },
    logout: { btn: document.getElementById('nav-logout'), section: null }
};

const generalAverageCard = document.getElementById('general-average');
const nextModuleCard = document.getElementById('next-module');
const noticesCard = document.getElementById('notices');

// --- FUNÇÕES GERAIS ---
async function fetchData(url) {
    try {
        const response = await fetch(`${url}&timestamp=${new Date().getTime()}`);
        if (!response.ok) throw new Error(`Falha ao buscar dados de ${url}`);
        const csvText = await response.text();
        const rows = csvText.split('\n').map(row => row.trim().replace(/"/g, '')).filter(row => row);
        if (rows.length < 1) { console.warn(`Nenhum dado na URL: ${url}`); return []; }
        const headers = rows[0].split(',').map(h => h.trim());
        const data = rows.slice(1).map(row => {
            const values = row.split(',');
            let obj = {};
            headers.forEach((header, index) => {
                obj[header] = values[index] ? values[index].trim() : '';
            });
            return obj;
        });
        return data;
    } catch (error) {
        console.error("Erro ao buscar dados:", error);
        loginErrorMessage.textContent = 'Erro de comunicação com a base de dados.';
        return null;
    }
}

// --- LÓGICA DE AUTENTICAÇÃO E INÍCIO ---
loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    loginErrorMessage.textContent = '';
    loginButton.disabled = true;
    loginButton.textContent = 'Verificando...';

    const [students, courses] = await Promise.all([
        fetchData(GOOGLE_SHEET_URL_DADOS),
        fetchData(GOOGLE_SHEET_URL_CURSOS)
    ]);

    loginButton.disabled = false;
    loginButton.textContent = 'Acessar';

    if (!students || !courses) return;
    
    const studentId = studentIdInput.value.trim();
    const passwordOrCode = passwordInput.value.trim();
    const student = students.find(s => s.ID_Aluno === studentId);

    if (!student) {
        loginErrorMessage.textContent = 'ID do Aluno não encontrado.';
        return;
    }

    const courseStructure = courses.find(c => c.CursoID === student.CursoID);
    if (!courseStructure) {
        loginErrorMessage.textContent = 'Estrutura do curso não encontrada.';
        return;
    }

    if (student.Senha === '' && student.CodigoTemporario === passwordOrCode) {
        currentStudentId = student.ID_Aluno;
        loginContainer.classList.add('hidden');
        passwordSetupContainer.classList.remove('hidden');
    } else if (student.Senha !== '' && student.Senha === passwordOrCode) {
        loginContainer.classList.add('hidden');
        document.body.classList.add('dashboard-open');
        dashboardLayout.classList.remove('hidden');
        populateDashboard(student, courseStructure);
        activateSection(navLinks.dashboard.section, navLinks.dashboard.btn);
    } else {
        loginErrorMessage.textContent = 'Senha ou Código Temporário inválido.';
    }
});

passwordSetupForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    passwordErrorMessage.textContent = '';
    const newPassword = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    if (newPassword.length !== 4 || !/^\d{4}$/.test(newPassword)) {
        passwordErrorMessage.textContent = 'A senha deve ter exatamente 4 números.';
        return;
    }
    if (newPassword !== confirmPassword) {
        passwordErrorMessage.textContent = 'As senhas não coincidem.';
        return;
    }

    passwordSetupButton.disabled = true;
    passwordSetupButton.textContent = 'Salvando...';

    try {
        const response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'cors',
            body: JSON.stringify({ studentId: currentStudentId, newPassword: newPassword }),
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const result = await response.json();
        if (result.status === 'success') {
            alert('Senha cadastrada com sucesso! Você será redirecionado para a tela de login.');
            window.location.reload();
        } else {
            passwordErrorMessage.textContent = result.message || 'Erro ao salvar a senha.';
        }
    } catch (error) {
        console.error('Fetch Error:', error);
        passwordErrorMessage.textContent = 'Erro de comunicação ao salvar a senha.';
    } finally {
        passwordSetupButton.disabled = false;
        passwordSetupButton.textContent = 'Cadastrar Senha';
    }
});

// --- LÓGICA DA ÁREA DO ALUNO (DASHBOARD) ---
function populateDashboard(student, course) {
    topbarStudentPhoto.src = student.FotoURL || FOTO_PADRAO_URL;
    topbarStudentName.textContent = student.NomeCompleto;
    topbarStudentCourse.textContent = `Curso: ${course.NomeDoCurso}`;
    topbarStudentClassProf.textContent = `Turma Prof.: ${student.Turma}`;
    topbarStudentClassFH.textContent = `Turma FH: ${student.TurmaFormacaoHumana || 'N/A'}`;

    generalAverageCard.textContent = calculateGeneralAverage(student, course).toFixed(1);
    nextModuleCard.textContent = getNextModule(student, course);
    noticesCard.textContent = 'Nenhum';

    const gradesContainer = document.getElementById('grades-summary-container');
    gradesContainer.innerHTML = '';
    
    const moduleNames = course.Modulos.split(',');
    const gradeColumns = course.ColunasDasNotas.split(',');
    const gradesForChart = [];

    moduleNames.forEach((moduleName, index) => {
        const gradeColumn = gradeColumns[index];
        const gradeValue = parseFloat((student[gradeColumn] || "0").replace(',', '.'));
        gradesForChart.push(isNaN(gradeValue) ? 0 : gradeValue);

        const gradeCard = document.createElement('div');
        gradeCard.className = 'grade-card';
        gradeCard.innerHTML = `<h3>${moduleName.trim()}</h3><p class="grade">${isNaN(gradeValue) ? 'N/L' : gradeValue.toFixed(1)}</p>`;
        gradesContainer.appendChild(gradeCard);
    });

    createChart(moduleNames, gradesForChart);
}

function calculateGeneralAverage(student, course) {
    const gradeColumns = course.ColunasDasNotas.split(',');
    let totalGrades = 0;
    let validGradesCount = 0;
    gradeColumns.forEach(column => {
        const grade = parseFloat((student[column] || "0").replace(',', '.'));
        if (!isNaN(grade)) {
            totalGrades += grade;
            validGradesCount++;
        }
    });
    return validGradesCount > 0 ? totalGrades / validGradesCount : 0;
}

function getNextModule(student, course) {
    const moduleNames = course.Modulos.split(',');
    const gradeColumns = course.ColunasDasNotas.split(',');
    for (let i = 0; i < gradeColumns.length; i++) {
        const grade = parseFloat((student[gradeColumns[i]] || "0").replace(',', '.'));
        if (isNaN(grade) || grade === 0) {
            return moduleNames[i].trim();
        }
    }
    return 'Concluído';
}

let performanceChart = null;
function createChart(labels, grades) {
    const ctx = document.getElementById('performanceChart').getContext('2d');
    if (performanceChart) { performanceChart.destroy(); }
    
    performanceChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Nota', data: grades,
                backgroundColor: 'rgba(188, 104, 161, 0.7)',
                borderColor: 'rgba(188, 104, 161, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, max: 10, grid: { color: 'rgba(0, 0, 0, 0.1)' }, ticks: { color: 'var(--cor-texto-principal)' } },
                x: { grid: { color: 'rgba(0, 0, 0, 0.1)' }, ticks: { color: 'var(--cor-texto-principal)' } }
            },
            plugins: { legend: { display: false } }
        }
    });
    updateChartTheme();
}

function updateChartTheme() {
    if (performanceChart) {
        const isDarkMode = document.body.classList.contains('dark-mode');
        const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)';
        performanceChart.options.scales.y.grid.color = gridColor;
        performanceChart.options.scales.x.grid.color = gridColor;
        performanceChart.options.scales.y.ticks.color = 'var(--cor-texto-principal)';
        performanceChart.options.scales.x.ticks.color = 'var(--cor-texto-principal)';
        performanceChart.update();
    }
}

// --- NAVEGAÇÃO ENTRE SEÇÕES ---
function activateSection(sectionElement, navLinkElement) {
    allContentSections.forEach(section => section.classList.add('hidden'));
    document.querySelectorAll('.sidebar-nav a').forEach(link => link.classList.remove('active'));

    sectionElement.classList.remove('hidden');
    if (navLinkElement) navLinkElement.classList.add('active');

    if (window.innerWidth <= 992) {
        sidebar.classList.remove('active');
        overlay.classList.add('hidden');
        document.body.classList.remove('dashboard-open');
        menuToggle.classList.remove('active');
    }
}

Object.values(navLinks).forEach(link => {
    if (link.btn && link.section) {
        link.btn.addEventListener('click', (e) => {
            e.preventDefault();
            activateSection(link.section, link.btn);
        });
    }
});

navLinks.logout.btn.addEventListener('click', () => { window.location.reload(); });

// --- LÓGICA DOS MENUS (DESKTOP E MOBILE) ---
sidebarToggle.addEventListener('click', () => {
    document.body.classList.toggle('sidebar-collapsed');
});

menuToggle.addEventListener('click', () => {
    sidebar.classList.toggle('active');
    overlay.classList.toggle('hidden');
    menuToggle.classList.toggle('active');
    document.body.classList.toggle('dashboard-open');
});
overlay.addEventListener('click', () => {
    sidebar.classList.remove('active');
    overlay.classList.add('hidden');
    menuToggle.classList.remove('active');
    document.body.classList.remove('dashboard-open');
});

// --- LÓGICA DO DARK MODE ---
const darkModeToggle = document.getElementById('darkmode-toggle');
const currentTheme = localStorage.getItem('theme');
if (currentTheme) {
    document.body.classList.add(currentTheme);
    if (currentTheme === 'dark-mode') { darkModeToggle.checked = true; }
} else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.body.classList.add('dark-mode');
    darkModeToggle.checked = true;
}

function switchTheme(e) {
    if (e.target.checked) {
        document.body.classList.add('dark-mode');
        localStorage.setItem('theme', 'dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
        localStorage.setItem('theme', 'light-mode');
    }
    updateChartTheme();
}
darkModeToggle.addEventListener('change', switchTheme, false);
window.addEventListener('DOMContentLoaded', updateChartTheme);

// --- LÓGICA DE MOSTRAR/ESCONDER SENHA ---
document.querySelectorAll('.password-toggle-checkbox input[type="checkbox"]').forEach(checkbox => {
    checkbox.addEventListener('change', function () {
        const input = this.closest('.input-group').querySelector('input[type="password"], input[type="text"]');
        if (input) {
            input.setAttribute('type', this.checked ? 'text' : 'password');
        }
    });
});