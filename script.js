$(document).ready(function () {
    let db;
    const DB_NAME = 'CardsApp';
    const DB_VERSION = 1;
    let currentUser = null;

    const adminData = {
        username: "admin@admin.com",
        password: "administrator"
    };

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = function (event) {
        console.error("Database error: " + event.target.errorCode);
    };

    request.onupgradeneeded = function (event) {
        db = event.target.result;

        if (!db.objectStoreNames.contains('users')) {
            db.createObjectStore('users', { keyPath: 'username' });
        }

        if (!db.objectStoreNames.contains('cards')) {
            const cardsStore = db.createObjectStore('cards', { keyPath: 'id', autoIncrement: true });
            cardsStore.createIndex('status', 'status', { unique: false });
        }

        if (!db.objectStoreNames.contains('currentUser')) {
            db.createObjectStore('currentUser', { keyPath: 'id' });
        }
    };

    request.onsuccess = function (event) {
        db = event.target.result;
        console.log("Database opened successfully");

        checkAuth();

        if (window.location.pathname.includes('cards.html')) {
            displayCards();
        }
    };

    $('#register-form').on('submit', function (event) {
        event.preventDefault();

        const username = $('#register-username').val();
        const password = $('#register-password').val();

        if (!username || !password) {
            alert('Заполните все поля');
            return;
        }

        const transaction = db.transaction(['users'], 'readwrite');
        const userStore = transaction.objectStore('users');

        const user = { username, password };
        const request = userStore.add(user);

        request.onsuccess = function () {
            alert('Регистрация прошла успешно! Вы можете войти в свой акаунт.');
            window.location.href = 'login.html';
        };

        request.onerror = function () {
            alert('Ошибка при регистрации. Возможно, такой пользователь уже существует.');
        };
    });

    $('#login-form').on('submit', function (event) {
        event.preventDefault();

        const username = $('#login-username').val();
        const password = $('#login-password').val();

        if (!username || !password) {
            alert('Заполните все поля.');
            return;
        }

        if (username === adminData.username && password === adminData.password) {
            setCurrentUser({ username: 'admin', isAdmin: true });
            return;
        }

        const transaction = db.transaction(['users'], 'readonly');
        const userStore = transaction.objectStore('users');
        const request = userStore.get(username);

        request.onsuccess = function (event) {
            const user = event.target.result;
            if (user && password === user.password) {
                setCurrentUser({ username: user.username, isAdmin: false });
            } else {
                alert('Такого пользователя не существует. Введите корректные данные.');
            }
        };

        request.onerror = function () {
            alert('Ошибка при входе в систему.');
        };
    });

    function setCurrentUser(user) {
        const transaction = db.transaction(['currentUser'], 'readwrite');
        const userStore = transaction.objectStore('currentUser');

        const clearRequest = userStore.clear();

        clearRequest.onsuccess = function () {
            const addRequest = userStore.add({ id: 1, ...user });

            addRequest.onsuccess = function () {
                window.location.href = 'cards.html';
            };
        };
    }

    $(document).on('click', '.logout-btn', function () {
        const transaction = db.transaction(['currentUser'], 'readwrite');
        const userStore = transaction.objectStore('currentUser');

        const request = userStore.clear();

        request.onsuccess = function () {
            console.log('Logout successful');
            window.location.href = 'index.html';
        };
    });

    $('.profile-btn').on('click', function () {
        $('#profile-dropdown').toggleClass('show');
    });

   

    $('#create-form').on('submit', function (event) {
        event.preventDefault();

        const title = $('#card-title').val();
        const description = $('#card-description').val();
        const num = $('#card-num').val();
        const pay = $('#card-pay').val();


        if (!title || !description|| !num || !pay) {
            alert('Заполните все поля');
            return;
        }
        else {
            saveCard(title, description,num, pay);
        }

    });

    function saveCard(title, description, num, pay) {
    getCurrentUser(function (user) {
        if (!user) {
            alert('Пользователь не авторизован');
            return;
        }

        const transaction = db.transaction(['cards'], 'readwrite');
        const cardsStore = transaction.objectStore('cards');

        const card = {
            title,
            description,
            num,
            pay,
            status: 'новое',
            createdBy: user.username
        };

        const request = cardsStore.add(card);

        request.onsuccess = function () {
            alert('Заявка создана успешно!');
            window.location.href = 'cards.html';
        };

        request.onerror = function () {
            alert('Ошибка при создании заявки');
        };
    });
}

    function displayCards() {
        getCurrentUser(function (currentUser) {
            if (!currentUser) {
                window.location.href = 'index.html';
                return;
            }

            $('#username').text(currentUser.username);
            $('#cards-container').empty();

            const transaction = db.transaction(['cards'], 'readonly');
            const cardsStore = transaction.objectStore('cards');
            const request = cardsStore.getAll();

            request.onsuccess = function (event) {
                const cards = event.target.result;

                // отображениеть
                if (cards.length === 0) {
                    $('#cards-container').html('<p>Нет записей. Запишитесь на игру</p>');
                } else {
                    $.each(cards, function (index, card) {
                        const cardElement = $('<div>').addClass('card');

                        let cardContent = `
                            <p>Заявка от: ${currentUser.username}</p>
                            <h3>${card.title}</h3>
                            <p>${card.description}</p>
                            <p>Количество человек: ${card.num}</p>
                            <p>Тип оплаты: ${card.pay}</p>
                            <p>Статус: ${card.status}</p>
                        `;

                        cardElement.html(cardContent);

                        if (currentUser.username === 'admin') {
                            const deleteButton = $('<button>')
                                .text('Удалить')
                                .addClass('delete-button')
                                .data('id', card.id)
                                .on('click', function () {
                                    deleteCard($(this).data('id'));
                                });
                            cardElement.append(deleteButton);

                            const statusSelect = $('<select>')
                                .addClass('status-select')
                                .data('id', card.id);

                            const statuses = ['новая', 'принята', 'отклонена'];
                            $.each(statuses, function (i, status) {
                                const option = $('<option>')
                                    .val(status)
                                    .text(status);
                                if (status === card.status) {
                                    option.prop('selected', true);
                                }
                                statusSelect.append(option);
                            });

                            statusSelect.on('change', function () {
                                changeStatus($(this).data('id'), $(this).val());
                            });
                            cardElement.append(statusSelect);
                        }

                        $('#cards-container').append(cardElement);
                    });
                }
            };

            request.onerror = function () {
                console.error("Error fetching cards");
            };
        });
    }

    function changeStatus(id, newStatus) {
        const transaction = db.transaction(['cards'], 'readwrite');
        const cardsStore = transaction.objectStore('cards');

        const request = cardsStore.get(id);

        request.onsuccess = function (event) {
            const card = event.target.result;
            card.status = newStatus;

            const updateRequest = cardsStore.put(card);

            updateRequest.onsuccess = function () {
                displayCards();
            };
        };
    }

    function deleteCard(id) {
        const transaction = db.transaction(['cards'], 'readwrite');
        const cardsStore = transaction.objectStore('cards');

        const request = cardsStore.delete(id);

        request.onsuccess = function () {
            displayCards();
        };
    }

    function getCurrentUser(callback) {
        const transaction = db.transaction(['currentUser'], 'readonly');
        const userStore = transaction.objectStore('currentUser');

        const request = userStore.get(1);

        request.onsuccess = function (event) {
            callback(event.target.result);
        };

        request.onerror = function () {
            callback(null);
        };
    }

    function checkAuth() {
        const protectedPages = ['cards.html', 'create.html', 'in.html'];
        const currentPage = window.location.pathname.split('/').pop();

        if (protectedPages.includes(currentPage)) {
            getCurrentUser(function (user) {
                if (!user) {
                    window.location.href = 'login.html';
                }
            });
        }
    }

    $(document).on('click', function (e) {
        if (!$(e.target).hasClass('profile-btn')) {
            if ($('#profile-dropdown').hasClass('show')) {
                $('#profile-dropdown').removeClass('show');
            }
        }
    });
});