const API_URL = 'https://randomuser.me/api/';
const RESULTS_PER_PAGE = 30;
const SEED = 'lab10-socialfinder';

const STATE = {
    users: [],
    savedFriends: new Set(),
    apiPage: 1,
    isLoading: false,
    reachedEnd: false,
    filters: {
        search: '',
        gender: 'all',
        minAge: '',
        maxAge: '',
        birthYear: '',
        location: '',
        email: '',
        sort: 'name-asc',
        selectedOnly: false
    }
};

const DOM = {
    authSection: document.getElementById('auth-section'),
    appContainer: document.getElementById('app-container'),
    loginForm: document.getElementById('login'),
    registerForm: document.getElementById('register'),
    tabs: document.querySelectorAll('.tab-btn'),
    currentUserName: document.getElementById('current-user-name'),
    logoutBtn: document.getElementById('logout-btn'),

    usersGrid: document.getElementById('users-grid'),
    loader: document.getElementById('loader'),
    pagination: document.getElementById('pagination'),
    sentinel: document.getElementById('sentinel'),
    toast: document.getElementById('toast'),

    searchInput: document.getElementById('search-input'),
    minAge: document.getElementById('min-age'),
    maxAge: document.getElementById('max-age'),
    birthYear: document.getElementById('birth-year'),
    locationInput: document.getElementById('location-input'),
    emailInput: document.getElementById('email-input'),
    genderRadios: document.querySelectorAll('input[name="gender"]'),
    sortSelect: document.getElementById('sort-select'),
    selectedOnlyBtn: document.getElementById('selected-only-btn'),
    resetBtn: document.getElementById('reset-btn'),

    statsInfo: document.getElementById('stats-info'),
    activeFiltersStr: document.getElementById('active-filters')
};

const debounce = (fn, delay = 350) => {
    let timerId;
    return (...args) => {
        clearTimeout(timerId);
        timerId = setTimeout(() => fn(...args), delay);
    };
};

const showToast = (message, isError = false) => {
    DOM.toast.innerHTML = `<i class="fas ${isError ? 'fa-exclamation-circle' : 'fa-check-circle'}"></i> ${message}`;
    DOM.toast.className = `toast ${isError ? 'error' : ''}`;
    setTimeout(() => DOM.toast.classList.add('hidden'), 3000);
};

const getFullName = (u) => `${u.name.first} ${u.name.last}`;
const getLocation = (u) => `${u.location.city}, ${u.location.country}`;
const getRegDate = (u) => new Date(u.registered.date);
const getBirthYear = (u) => new Date(u.dob.date).getFullYear();

const sorters = {
    'name-asc': (a, b) => getFullName(a).localeCompare(getFullName(b)),
    'name-desc': (a, b) => getFullName(b).localeCompare(getFullName(a)),
    'age-asc': (a, b) => a.dob.age - b.dob.age,
    'age-desc': (a, b) => b.dob.age - a.dob.age,
    'reg-new': (a, b) => getRegDate(b) - getRegDate(a),
    'reg-old': (a, b) => getRegDate(a) - getRegDate(b)
};

const applyFilters = (users, filters, savedIds) => {
    const query = filters.search.toLowerCase();
    const locQuery = filters.location.toLowerCase();
    const emailQuery = filters.email.toLowerCase();
    const min = Number(filters.minAge) || 0;
    const max = Number(filters.maxAge) || Infinity;
    const bYear = Number(filters.birthYear);

    return users.filter(u => {
        if (filters.selectedOnly && !savedIds.has(u.login.uuid)) return false;
        if (filters.gender !== 'all' && u.gender !== filters.gender) return false;
        if (query && !getFullName(u).toLowerCase().includes(query)) return false;
        if (locQuery && !getLocation(u).toLowerCase().includes(locQuery)) return false;
        if (emailQuery && !u.email.toLowerCase().includes(emailQuery)) return false;
        if (bYear && getBirthYear(u) !== bYear) return false;
        return !(u.dob.age < min || u.dob.age > max);

    }).sort(sorters[filters.sort]);
};

DOM.tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        DOM.tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.querySelectorAll('.form-content').forEach(f => f.style.display = 'none');
        document.getElementById(tab.dataset.tab).style.display = 'block';
    });
});

document.querySelectorAll('.toggle-password').forEach(btn => {
    btn.addEventListener('click', function() {
        const input = this.previousElementSibling;
        const icon = this.querySelector('i');
        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            input.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    });
});

const handleAuth = (e) => {
    e.preventDefault();
    const form = e.target;
    const isLogin = form.id === 'login';
    const inputs = form.querySelectorAll('input');

    let isValid = true;
    inputs.forEach(input => {
        const errorDisplay = input.closest('.form-group').querySelector('.error-text');
        if (!input.value.trim() || (input.type === 'password' && input.value.length < 6)) {
            errorDisplay.innerText = input.type === 'password' ? 'Мінімум 6 символів' : 'Поле обов\'язкове';
            input.style.borderColor = 'red';
            isValid = false;
        } else {
            errorDisplay.innerText = '';
            input.style.borderColor = 'green';
        }
    });

    if (isValid) {
        const username = isLogin ? form.querySelector('[name="username"]').value : form.querySelector('[name="name"]').value;
        localStorage.setItem('currentUser', username);
        checkAuth();
    }
};

DOM.loginForm.addEventListener('submit', handleAuth);
DOM.registerForm.addEventListener('submit', handleAuth);

DOM.logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('currentUser');
    checkAuth();
});

const checkAuth = () => {
    const user = localStorage.getItem('currentUser');
    if (user) {
        DOM.authSection.style.display = 'none';
        DOM.appContainer.style.display = 'block';
        DOM.currentUserName.innerHTML = `<i class="fas fa-user-circle"></i> ${user}`;
        initApp();
    } else {
        DOM.authSection.style.display = 'flex';
        DOM.appContainer.style.display = 'none';
    }
};

const syncStateToURL = () => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(STATE.filters)) {
        if (value && value !== 'all' && value !== false && value !== 'name-asc') {
            params.set(key, value);
        }
    }
    const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
    window.history.pushState({ filters: STATE.filters }, '', newUrl);
};

const parseURLToState = () => {
    const params = new URLSearchParams(window.location.search);
    STATE.filters.search = params.get('search') || '';
    STATE.filters.gender = params.get('gender') || 'all';
    STATE.filters.minAge = params.get('minAge') || '';
    STATE.filters.maxAge = params.get('maxAge') || '';
    STATE.filters.birthYear = params.get('birthYear') || '';
    STATE.filters.location = params.get('location') || '';
    STATE.filters.email = params.get('email') || '';
    STATE.filters.sort = params.get('sort') || 'name-asc';
    STATE.filters.selectedOnly = params.get('selectedOnly') === 'true';

    DOM.searchInput.value = STATE.filters.search;
    DOM.minAge.value = STATE.filters.minAge;
    DOM.maxAge.value = STATE.filters.maxAge;
    DOM.birthYear.value = STATE.filters.birthYear;
    DOM.locationInput.value = STATE.filters.location;
    DOM.emailInput.value = STATE.filters.email;
    DOM.sortSelect.value = STATE.filters.sort;
    const genderRadio = document.querySelector(`input[name="gender"][value="${STATE.filters.gender}"]`);
    if (genderRadio) genderRadio.checked = true;
    DOM.selectedOnlyBtn.classList.toggle('active', STATE.filters.selectedOnly);
};

const fetchUsers = async () => {
    if (STATE.isLoading || STATE.reachedEnd) return;
    STATE.isLoading = true;
    DOM.loader.style.display = 'block';

    try {
        const response = await fetch(`${API_URL}?page=${STATE.apiPage}&results=${RESULTS_PER_PAGE}&seed=${SEED}`);
        if (!response.ok) throw new Error('Помилка завантаження');

        const data = await response.json();
        if (data.results.length === 0) STATE.reachedEnd = true;

        const newUsers = data.results.filter(nu => !STATE.users.some(su => su.login.uuid === nu.login.uuid));
        STATE.users = [...STATE.users, ...newUsers];
        STATE.apiPage++;

    } catch (error) {
        showToast('Помилка з\'єднання з API', true);
    } finally {
        STATE.isLoading = false;
        DOM.loader.style.display = 'none';
        updateUI();
    }
};

const renderCards = (users) => {
    if (users.length === 0) {
        DOM.usersGrid.innerHTML = '<div style="grid-column: 1/-1; text-align:center;"><i class="fas fa-search-minus fa-2x"></i><br>Нічого не знайдено за вашими критеріями.</div>';
        return;
    }

    DOM.usersGrid.innerHTML = users.map(user => {
        const id = user.login.uuid;
        const isSaved = STATE.savedFriends.has(id);
        const date = new Date(user.registered.date).toLocaleDateString('uk-UA');

        return `
            <article class="user-card ${isSaved ? 'saved' : ''}">
                <img src="${user.picture.large}" alt="${user.name.first}" class="user-avatar" loading="lazy">
                <h3>${getFullName(user)}</h3>
                <div class="user-info">
                    <p><i class="fas fa-envelope"></i> ${user.email}</p>
                    <p><i class="fas fa-phone-alt"></i> ${user.phone}</p> <p><i class="fas fa-map-marker-alt"></i> ${getLocation(user)}</p>
                </div>
                
                <div class="badges-container">
                    <span class="badge">Вік: ${user.dob.age} (Р.Н.: ${getBirthYear(user)})</span>
                    <span class="badge">Реєстрація: ${date}</span>
                </div>
                
                <button class="btn btn-save ${isSaved ? 'saved' : ''}" data-uuid="${id}">
                    <i class="fas ${isSaved ? 'fa-heart-broken' : 'fa-heart'}"></i> ${isSaved ? 'Видалити з обраних' : 'Додати в обрані'}
                </button>
            </article>
        `;
    }).join('');
};

const updateUI = () => {
    const processedUsers = applyFilters(STATE.users, STATE.filters, STATE.savedFriends);
    renderCards(processedUsers);
    syncStateToURL();

    DOM.statsInfo.innerHTML = `<i class="fas fa-users"></i> Знайдено: ${processedUsers.length} | <i class="fas fa-heart"></i> Обрано: ${STATE.savedFriends.size}`;
    DOM.pagination.textContent = `Завантажено сторінок з API: ${STATE.apiPage - 1}`;

    const active = [];
    if (STATE.filters.search) active.push('Пошук');
    if (STATE.filters.gender !== 'all') active.push('Стать');
    if (STATE.filters.minAge || STATE.filters.maxAge || STATE.filters.birthYear) active.push('Вік/Рік');
    if (STATE.filters.location) active.push('Локація');
    DOM.activeFiltersStr.textContent = active.length > 0 ? `Активні фільтри: ${active.join(', ')}` : 'Фільтри не застосовані';
};

const handleFilterChange = (key, value) => {
    STATE.filters[key] = value;
    updateUI();
};

DOM.searchInput.addEventListener('input', debounce(e => handleFilterChange('search', e.target.value.trim())));
DOM.minAge.addEventListener('input', debounce(e => handleFilterChange('minAge', e.target.value)));
DOM.maxAge.addEventListener('input', debounce(e => handleFilterChange('maxAge', e.target.value)));
DOM.birthYear.addEventListener('input', debounce(e => handleFilterChange('birthYear', e.target.value)));
DOM.locationInput.addEventListener('input', debounce(e => handleFilterChange('location', e.target.value.trim())));
DOM.emailInput.addEventListener('input', debounce(e => handleFilterChange('email', e.target.value.trim())));

DOM.sortSelect.addEventListener('change', e => handleFilterChange('sort', e.target.value));

DOM.genderRadios.forEach(r => r.addEventListener('change', e => handleFilterChange('gender', e.target.value)));

DOM.selectedOnlyBtn.addEventListener('click', () => {
    STATE.filters.selectedOnly = !STATE.filters.selectedOnly;
    DOM.selectedOnlyBtn.classList.toggle('active', STATE.filters.selectedOnly);
    updateUI();
});

DOM.resetBtn.addEventListener('click', () => {
    STATE.filters = { search: '', gender: 'all', minAge: '', maxAge: '', birthYear: '', location: '', email: '', sort: 'name-asc', selectedOnly: false };
    parseURLToState();
    updateUI();
    showToast('Фільтри скинуто');
});

DOM.usersGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-save');
    if (btn) {
        const uuid = btn.dataset.uuid;
        if (STATE.savedFriends.has(uuid)) {
            STATE.savedFriends.delete(uuid);
        } else {
            STATE.savedFriends.add(uuid);
        }
        localStorage.setItem('savedFriends', JSON.stringify([...STATE.savedFriends]));
        updateUI();
    }
});

const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !STATE.isLoading && !STATE.reachedEnd && DOM.appContainer.style.display !== 'none') {
        fetchUsers();
    }
}, { rootMargin: '300px' });

window.addEventListener('popstate', (e) => {
    if (e.state && e.state.filters) {
        STATE.filters = e.state.filters;
        parseURLToState();
        updateUI();
    }
});

const initApp = () => {
    parseURLToState();
    const saved = localStorage.getItem('savedFriends');
    if (saved) {
        STATE.savedFriends = new Set(JSON.parse(saved));
    }
    observer.observe(DOM.sentinel);
    if (STATE.users.length === 0) fetchUsers();
};

document.addEventListener('DOMContentLoaded', checkAuth);