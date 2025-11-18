class Book {
    constructor({ id, title, authors, thumbnail, description, pageCount, isAudio = false }) {
        this.id = id;
        this.title = title;
        this.authors = authors || ["Unknown author"];
        this.thumbnail = thumbnail;
        this.description = description || "";
        this.pageCount = pageCount || 0;
        this.isAudio = isAudio;
    }

    static fromGoogleVolume(volume, isAudio = false) {
        const info = volume.volumeInfo || {};
        return new Book({
            id: volume.id,
            title: info.title || "Untitled",
            authors: info.authors || ["Unknown author"],
            thumbnail:
                (info.imageLinks && (info.imageLinks.thumbnail || info.imageLinks.smallThumbnail)) ||
                null,
            description: info.description || "",
            pageCount: info.pageCount || 0,
            isAudio
        });
    }
}

class GoogleBooksAPI {
    static async search(query) {
        if (!query) return [];
        const url =
            "https://www.googleapis.com/books/v1/volumes?q=" +
            encodeURIComponent(query) +
            "&maxResults=15";
        const res = await fetch(url);
        const data = await res.json();
        if (!data.items) return [];
        return data.items.map((item) => Book.fromGoogleVolume(item, false));
    }

    static async popular() {
        const url =
            "https://www.googleapis.com/books/v1/volumes?q=" +
            encodeURIComponent("bestsellers fiction") +
            "&maxResults=15";
        const res = await fetch(url);
        const data = await res.json();
        if (!data.items) return [];
        return data.items.map((item) => Book.fromGoogleVolume(item, false));
    }

    static async recent() {
        const url =
            "https://www.googleapis.com/books/v1/volumes?q=" +
            encodeURIComponent("subject:fiction") +
            "&orderBy=newest&maxResults=15";
        const res = await fetch(url);
        const data = await res.json();
        if (!data.items) return [];
        return data.items.map((item) => Book.fromGoogleVolume(item, false));
    }

    static async audiobooks() {
        const url =
            "https://www.googleapis.com/books/v1/volumes?q=" +
            encodeURIComponent("audiobook fiction") +
            "&maxResults=15";
        const res = await fetch(url);
        const data = await res.json();
        if (!data.items) return [];
        return data.items.map((item) => Book.fromGoogleVolume(item, true));
    }
}

class FavoritesStorage {
    constructor(key = "litmate_favorites") {
        this.key = key;
    }

    load() {
        try {
            const raw = localStorage.getItem(this.key);
            if (!raw) return [];
            return JSON.parse(raw);
        } catch {
            return [];
        }
    }

    save(list) {
        localStorage.setItem(this.key, JSON.stringify(list));
    }

    isFavorite(list, bookId) {
        return list.some((b) => b.id === bookId);
    }

    toggle(list, book) {
        if (this.isFavorite(list, book.id)) {
            return list.filter((b) => b.id !== book.id);
        }
        return [...list, book];
    }
}

class ThemeManager {
    constructor() {
        this.body = document.body;
        this.iconEl = document.getElementById("themeIcon");
        this.labelEl = document.getElementById("themeLabel");
    }

    init() {
        const saved = localStorage.getItem("litmate_theme");
        if (saved === "dark" || saved === "light") {
            this.setTheme(saved);
        } else {
            this.setTheme("light");
        }
    }

    toggle() {
        const current = this.body.getAttribute("data-theme");
        const next = current === "light" ? "dark" : "light";
        this.setTheme(next);
    }

    setTheme(theme) {
        this.body.setAttribute("data-theme", theme);
        localStorage.setItem("litmate_theme", theme);
        if (this.iconEl && this.labelEl) {
            if (theme === "dark") {
                this.iconEl.textContent = "☀️";
                this.labelEl.textContent = "Light";
            } else {
                this.iconEl.textContent = "🌙";
                this.labelEl.textContent = "Dark";
            }
        }
    }
}

class BookModalManager {
    constructor() {
        this.overlay = document.getElementById("bookModalOverlay");
        this.modal = document.getElementById("bookModal");
        this.closeBtn = document.getElementById("modalClose");
        this.coverEl = document.getElementById("modalCover");
        this.titleEl = document.getElementById("modalTitle");
        this.authorsEl = document.getElementById("modalAuthors");
        this.descEl = document.getElementById("modalDescription");
        this.readBtn = document.getElementById("modalReadBtn");
        this.currentBook = null;

        if (this.overlay && this.closeBtn) {
            this.closeBtn.addEventListener("click", () => this.close());
            this.overlay.addEventListener("click", (e) => {
                if (e.target === this.overlay) this.close();
            });
            document.addEventListener("keydown", (e) => {
                if (e.key === "Escape") this.close();
            });
        }
    }

    open(book) {
        if (!this.overlay) return;
        this.currentBook = book;

        if (this.coverEl) {
            if (book.thumbnail) {
                this.coverEl.src = book.thumbnail;
                this.coverEl.alt = book.title;
            } else {
                this.coverEl.removeAttribute("src");
                this.coverEl.alt = "No cover";
            }
        }

        if (this.titleEl) this.titleEl.textContent = book.title;
        if (this.authorsEl) this.authorsEl.textContent = book.authors.join(", ");

        if (this.descEl) {
            const text = book.description || "No description available.";
            this.descEl.textContent = text.length > 600 ? text.slice(0, 600) + "…" : text;
        }

        if (this.readBtn) {
            this.readBtn.onclick = () => {
                window.open("https://books.google.com/books?id=" + book.id, "_blank");
            };
        }

        this.overlay.classList.add("modal-overlay--visible");
    }

    close() {
        if (!this.overlay) return;
        this.overlay.classList.remove("modal-overlay--visible");
        this.currentBook = null;
    }
}

class LitMateApp {
    constructor() {

        this.searchInput = document.getElementById("searchInput");
        this.searchBtn = document.getElementById("searchBtn");
        this.searchResults = document.getElementById("searchResults");
        this.searchStatus = document.getElementById("searchStatus");


        // sections
        this.popularRow = document.getElementById("popularRow");
        this.recentRow = document.getElementById("recentRow");
        this.genresRow = document.getElementById("genresRow");
        this.audioRow = document.getElementById("audioRow");

        // arrows
        this.popularPrevBtn = document.getElementById("popularPrev");
        this.popularNextBtn = document.getElementById("popularNext");
        this.recentPrevBtn = document.getElementById("recentPrev");
        this.recentNextBtn = document.getElementById("recentNext");
        this.audioPrevBtn = document.getElementById("audioPrev");
        this.audioNextBtn = document.getElementById("audioNext");

        // favorites
        this.favoritesList = document.getElementById("favoritesList");

        // theme
        this.themeToggle = document.getElementById("themeToggle");
        this.themeManager = new ThemeManager();

        // modal
        this.modalManager = new BookModalManager();

        // data
        this.favoritesStorage = new FavoritesStorage();
        this.favorites = this.favoritesStorage.load();

        this.popularBooks = [];
        this.recentBooks = [];
        this.audioBooks = [];

        this.popularPage = 0;
        this.recentPage = 0;
        this.audioPage = 0;

        this.PAGE_SIZE = 5;
    }

    init() {
        this.themeManager.init();
        this.bindEvents();
        this.renderFavorites();
        this.loadRecent();
        this.loadPopular();
        this.loadAudiobooks();
        this.renderGenres();
    }

    bindEvents() {
        // theme
        this.themeToggle.addEventListener("click", () => this.themeManager.toggle());

        // scroll nav
        document.querySelectorAll(".js-scroll").forEach((btn) => {
            btn.addEventListener("click", () => {
                const targetId = btn.dataset.target;
                const target = document.getElementById(targetId);
                if (target) {
                    target.scrollIntoView({ behavior: "smooth", block: "start" });
                }
            });
        });

        // search button + enter
        this.searchBtn.addEventListener("click", () => this.handleSearch());
        this.searchInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") this.handleSearch();
        });

        // chips
        document.querySelectorAll(".search-chip").forEach((chip) => {
            chip.addEventListener("click", () => {
                this.searchInput.value = chip.dataset.query;
                this.handleSearch();
            });
        });

        // arrows
        this.popularPrevBtn.addEventListener("click", () =>
            this.changePage("popular", -1)
        );
        this.popularNextBtn.addEventListener("click", () =>
            this.changePage("popular", 1)
        );
        this.recentPrevBtn.addEventListener("click", () =>
            this.changePage("recent", -1)
        );
        this.recentNextBtn.addEventListener("click", () =>
            this.changePage("recent", 1)
        );
        this.audioPrevBtn.addEventListener("click", () =>
            this.changePage("audio", -1)
        );
        this.audioNextBtn.addEventListener("click", () =>
            this.changePage("audio", 1)
        );
    }

    async handleSearch() {
        const query = this.searchInput.value.trim();

        if (!query) {
            this.searchStatus.textContent = "Please enter a search query.";
            this.searchResults.innerHTML = "";
            return;
        }

        this.searchStatus.textContent = "Searching...";
        this.searchResults.innerHTML = "";

        try {
            const books = await GoogleBooksAPI.search(query);
            if (books.length === 0) {
                this.searchStatus.textContent = "No results. Try another query.";
                return;
            }
            this.searchStatus.textContent = `Found ${books.length} books.`;
            this.renderBooksGrid(books, this.searchResults);
        } catch (e) {
            console.error(e);
            this.searchStatus.textContent = "Error while loading books.";
        }
    }

    async loadPopular() {
        this.popularRow.innerHTML = "<p class='section-sub'>Loading popular...</p>";
        try {
            this.popularBooks = await GoogleBooksAPI.popular();
            this.popularPage = 0;
            this.renderPopular();
        } catch (e) {
            console.error(e);
            this.popularRow.innerHTML =
                "<p class='section-sub'>Failed to load popular books.</p>";
        }
    }

    async loadRecent() {
        this.recentRow.innerHTML = "<p class='section-sub'>Loading recent...</p>";
        try {
            this.recentBooks = await GoogleBooksAPI.recent();
            this.recentPage = 0;
            this.renderRecent();
        } catch (e) {
            console.error(e);
            this.recentRow.innerHTML =
                "<p class='section-sub'>Failed to load recent books.</p>";
        }
    }

    async loadAudiobooks() {
        this.audioRow.innerHTML = "<p class='section-sub'>Loading audiobooks...</p>";
        try {
            this.audioBooks = await GoogleBooksAPI.audiobooks();
            this.audioPage = 0;
            this.renderAudio();
        } catch (e) {
            console.error(e);
            this.audioRow.innerHTML =
                "<p class='section-sub'>Failed to load audiobooks.</p>";
        }
    }

    changePage(section, delta) {
        let books, page, setPage, row, prevBtn, nextBtn;
        if (section === "popular") {
            books = this.popularBooks;
            page = this.popularPage;
            setPage = (v) => (this.popularPage = v);
            row = this.popularRow;
            prevBtn = this.popularPrevBtn;
            nextBtn = this.popularNextBtn;
        } else if (section === "recent") {
            books = this.recentBooks;
            page = this.recentPage;
            setPage = (v) => (this.recentPage = v);
            row = this.recentRow;
            prevBtn = this.recentPrevBtn;
            nextBtn = this.recentNextBtn;
        } else {
            books = this.audioBooks;
            page = this.audioPage;
            setPage = (v) => (this.audioPage = v);
            row = this.audioRow;
            prevBtn = this.audioPrevBtn;
            nextBtn = this.audioNextBtn;
        }

        if (!books || books.length <= this.PAGE_SIZE) return;

        const maxPages = Math.ceil(books.length / this.PAGE_SIZE);
        let newPage = page + delta;
        if (newPage < 0) newPage = maxPages - 1;
        if (newPage >= maxPages) newPage = 0;
        setPage(newPage);

        const slice = this.getPageSlice(books, newPage);
        this.renderBooksGrid(
            slice,
            row,
            section === "audio" ? { metaLabel: "Audiobook" } : {}
        );
        this.updateArrowState(books, newPage, prevBtn, nextBtn);
    }

    getPageSlice(books, page) {
        const start = page * this.PAGE_SIZE;
        return books.slice(start, start + this.PAGE_SIZE);
    }

    renderPopular() {
        if (!this.popularBooks.length) {
            this.popularRow.innerHTML =
                "<p class='section-sub'>No popular books found.</p>";
            return;
        }
        const slice = this.getPageSlice(this.popularBooks, this.popularPage);
        this.renderBooksGrid(slice, this.popularRow);
        this.updateArrowState(
            this.popularBooks,
            this.popularPage,
            this.popularPrevBtn,
            this.popularNextBtn
        );
    }

    renderRecent() {
        if (!this.recentBooks.length) {
            this.recentRow.innerHTML =
                "<p class='section-sub'>No recent books found.</p>";
            return;
        }
        const slice = this.getPageSlice(this.recentBooks, this.recentPage);
        this.renderBooksGrid(slice, this.recentRow);
        this.updateArrowState(
            this.recentBooks,
            this.recentPage,
            this.recentPrevBtn,
            this.recentNextBtn
        );
    }

    renderAudio() {
        if (!this.audioBooks.length) {
            this.audioRow.innerHTML =
                "<p class='section-sub'>No audiobooks found.</p>";
            return;
        }
        const slice = this.getPageSlice(this.audioBooks, this.audioPage);
        this.renderBooksGrid(slice, this.audioRow, { metaLabel: "Audiobook" });
        this.updateArrowState(
            this.audioBooks,
            this.audioPage,
            this.audioPrevBtn,
            this.audioNextBtn
        );
    }

    updateArrowState(books, page, prevBtn, nextBtn) {
        const maxPages = Math.ceil(books.length / this.PAGE_SIZE);
        const disabled = books.length <= this.PAGE_SIZE || maxPages <= 1;
        prevBtn.disabled = disabled;
        nextBtn.disabled = disabled;
    }

    renderGenres() {
        const genres = [
            {
                title: "Epic fantasy worlds",
                description: "Magic systems, quests and other worlds.",
                label: "fantasy"
            },
            {
                title: "Urban fantasy",
                description: "Magic inside a modern city.",
                label: "urban fantasy"
            },
            {
                title: "High school & YA",
                description: "Young adult stories, coming of age.",
                label: "young adult"
            },
            {
                title: "Slow-burn romance",
                description: "Soft feelings, relationships, character growth.",
                label: "romance"
            },
            {
                title: "Romantasy",
                description: "Fantasy + romance in one story.",
                label: "romantasy"
            },
            {
                title: "Mystery & crime",
                description: "Detectives, investigations, plot twists.",
                label: "mystery"
            },
            {
                title: "Thriller & suspense",
                description: "Fast pacing, danger and tension.",
                label: "thriller"
            },
            {
                title: "Horror & dark fiction",
                description: "Creepy atmosphere, fear, anxiety.",
                label: "horror"
            },
            {
                title: "Historical fiction",
                description: "Stories set in the past.",
                label: "historical fiction"
            },
            {
                title: "Sci-fi & space",
                description: "Futuristic tech, space travel, dystopia.",
                label: "science fiction"
            },
            {
                title: "Non-fiction & self-help",
                description: "Real stories, psychology, productivity.",
                label: "self help"
            },
            {
                title: "Biography & memoir",
                description: "Lives of real people, memories.",
                label: "biography"
            },
            {
                title: "Poetry & classics",
                description: "Classic literature and poetry collections.",
                label: "classic literature"
            }
        ];

        this.genresRow.innerHTML = "";
        genres.forEach((g) => {
            const card = document.createElement("article");
            card.className = "book-card genre-card";

            const info = document.createElement("div");
            info.className = "book-info";

            const title = document.createElement("div");
            title.className = "book-title";
            title.textContent = g.title;

            const desc = document.createElement("div");
            desc.className = "book-author";
            desc.textContent = g.description;

            info.appendChild(title);
            info.appendChild(desc);

            const pill = document.createElement("div");
            pill.className = "genre-pill";
            pill.textContent = g.label;

            card.appendChild(info);
            card.appendChild(pill);

            card.addEventListener("click", () => {
                const url =
                    "explore.html?type=genre&q=" +
                    encodeURIComponent(g.label.toLowerCase());
                window.location.href = url;
            });

            this.genresRow.appendChild(card);
        });
    }

    updateFavoriteButtonsInGrids() {
        const cards = document.querySelectorAll(".book-card[data-book-id]");
        cards.forEach((card) => {
            const id = card.dataset.bookId;
            const btn = card.querySelector(".book-btn-sm--fav");
            if (!btn || !id) return;
            const isFav = this.favoritesStorage.isFavorite(this.favorites, id);
            btn.textContent = isFav ? "♥" : "♡";
        });
    }





    renderFavorites() {
        this.favoritesList.innerHTML = "";
        if (this.favorites.length === 0) {
            const p = document.createElement("p");
            p.className = "side-meta";
            p.textContent = "No favorites yet. Tap ♥ on any book.";
            this.favoritesList.appendChild(p);
            return;
        }

        this.favorites.forEach((book) => {
            const item = document.createElement("div");
            item.className = "side-item";

            const thumb = document.createElement("div");
            thumb.className = "side-thumb";
            if (book.thumbnail) {
                const img = document.createElement("img");
                img.src = book.thumbnail;
                img.alt = book.title;
                thumb.appendChild(img);
            }

            const textWrap = document.createElement("div");
            const main = document.createElement("div");
            main.className = "side-main";
            main.textContent = book.title;

            const meta = document.createElement("div");
            meta.className = "side-meta";
            meta.textContent = (book.authors || []).join(", ");

            textWrap.appendChild(main);
            textWrap.appendChild(meta);
            const removeBtn = document.createElement("button");
            removeBtn.className = "side-remove";
            removeBtn.textContent = "✕";
            removeBtn.title = "Remove from favorites";

            removeBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                this.favorites = this.favoritesStorage.toggle(this.favorites, book);
                this.favoritesStorage.save(this.favorites);
                this.renderFavorites();
                this.updateFavoriteButtonsInGrids();
            });

            item.appendChild(thumb);
            item.appendChild(textWrap);
            item.appendChild(removeBtn);
            item.addEventListener("click", () =>
                this.openBookModal(new Book(book))
            );

            this.favoritesList.appendChild(item);
        });
    }



    openBookModal(book) {
            this.modalManager.open(book);
    }

    renderBooksGrid(books, container, options = {}) {
        container.innerHTML = "";

        books.forEach((book) => {
            const card = document.createElement("article");
                card.className = "book-card";
            card.dataset.bookId = book.id;               // <<< добавили

            const cover = document.createElement("img");
            cover.className = "book-cover";
            if (book.thumbnail) {
                cover.src = book.thumbnail;
                cover.alt = book.title;
            }

            const info = document.createElement("div");
            info.className = "book-info";

            const title = document.createElement("div");
            title.className = "book-title";
            title.textContent = book.title;

            const author = document.createElement("div");
            author.className = "book-author";
            author.textContent = book.authors.join(", ");

            info.appendChild(title);
                info.appendChild(author);

            const actions = document.createElement("div");
            actions.className = "book-actions";

            const meta = document.createElement("div");
            meta.className = "book-meta";

            if (options.metaLabel) {
                meta.textContent = options.metaLabel;
            } else if (book.isAudio) {
                meta.textContent = "Audiobook";
            } else {
                meta.textContent = book.pageCount ? `${book.pageCount} pages` : "Book";
            }

            const buttonsWrap = document.createElement("div");

            const openBtn = document.createElement("button");
            openBtn.className = "book-btn-sm";
            openBtn.textContent = "Details";
            openBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                window.open(
                    "https://books.google.com/books?id=" + book.id,
                    "_blank"
                );
            });

            const favBtn = document.createElement("button");
            favBtn.className = "book-btn-sm book-btn-sm--fav";
            const isFav = this.favoritesStorage.isFavorite(this.favorites, book.id);
            favBtn.textContent = isFav ? "♥" : "♡";
            favBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                this.favorites = this.favoritesStorage.toggle(this.favorites, book);
                this.favoritesStorage.save(this.favorites);
                this.renderFavorites();
                this.updateFavoriteButtonsInGrids();  // <<< синхронизируем сердечки
            });

            buttonsWrap.appendChild(openBtn);
            buttonsWrap.appendChild(favBtn);

            actions.appendChild(meta);
            actions.appendChild(buttonsWrap);

            card.appendChild(cover);
            card.appendChild(info);
            card.appendChild(actions);

            card.addEventListener("click", () => {
                this.openBookModal(book);
            });

            container.appendChild(card);
        });
    }
}

class ExplorePage {
    constructor() {
        this.titleEl = document.getElementById("exploreTitle");
        this.subtitleEl = document.getElementById("exploreSubtitle");
        this.sectionTitleEl = document.getElementById("exploreSectionTitle");
        this.statusEl = document.getElementById("exploreStatus");
        this.gridEl = document.getElementById("exploreGrid");
        this.sortSelect = document.getElementById("exploreSort");
        this.longCheckbox = document.getElementById("exploreLong");

        this.themeToggle = document.getElementById("themeToggle");
        this.themeManager = new ThemeManager();


        this.favoritesStorage = new FavoritesStorage();
        this.favorites = this.favoritesStorage.load();

        this.modalManager = new BookModalManager();

        const params = new URLSearchParams(location.search);
        this.type = params.get("type") || "popular";
        this.genreQuery = params.get("q") || "";

        this.allBooks = [];
    }



    async init() {
        this.themeManager.init();
        this.bindEvents();
        this.setActiveTab();
        await this.loadBooks();
        this.applyAndRender();
    }

    bindEvents() {
        this.themeToggle.addEventListener("click", () => this.themeManager.toggle());
        this.sortSelect.addEventListener("change", () => this.applyAndRender());
        this.longCheckbox.addEventListener("change", () => this.applyAndRender());

        document.querySelectorAll(".explore-tab").forEach((tab) => {
            tab.addEventListener("click", async () => {
                this.type = tab.dataset.type;
                this.genreQuery = "";
                this.setActiveTab();
                await this.loadBooks();
                this.applyAndRender();
            });

        });
    }

    setActiveTab() {
        document.querySelectorAll(".explore-tab").forEach((tab) => {
            tab.classList.toggle(
                "explore-tab--active",
                tab.dataset.type === this.type
            );
        });
    }

    async loadBooks() {
        this.statusEl.textContent = "Loading...";
        try {
            if (this.type === "popular") {
                this.titleEl.textContent = "Popular books";
                this.subtitleEl.textContent =
                    "Extended list based on “bestsellers fiction”.";
                this.sectionTitleEl.textContent = "Popular — all results";
                this.allBooks = await GoogleBooksAPI.popular();
            } else if (this.type === "recent") {
                this.titleEl.textContent = "Recent books";
                this.subtitleEl.textContent = "Newest fiction books from Google Books.";
                this.sectionTitleEl.textContent = "Recent — all results";
                this.allBooks = await GoogleBooksAPI.recent();
            } else if (this.type === "audio") {
                this.titleEl.textContent = "Audiobooks";
                this.subtitleEl.textContent =
                    "Fiction audiobooks for listening on the go.";
                this.sectionTitleEl.textContent = "Audiobooks — all results";
                this.allBooks = await GoogleBooksAPI.audiobooks();
            } else if (this.type === "genre") {
                 const q = this.genreQuery || "fiction";
                this.titleEl.textContent = `Genre: ${q}`;
                this.subtitleEl.textContent =
                    "Books loaded based on selected genre keyword.";
                this.sectionTitleEl.textContent = `Genre — ${q}`;
                this.allBooks = await GoogleBooksAPI.search(q);
            } else if (this.type === "genres") {
                this.titleEl.textContent = "Genres mix";
                this.subtitleEl.textContent =
                    "Mix of different genres to explore.";
                this.sectionTitleEl.textContent = "Genres selection";
                const [fantasy, romance, mystery] = await Promise.all([
                    GoogleBooksAPI.search("fantasy"),
                    GoogleBooksAPI.search("romance"),
                    GoogleBooksAPI.search("mystery")
                ]);
                this.allBooks = [...fantasy, ...romance, ...mystery];
            } else {
                this.allBooks = await GoogleBooksAPI.popular();
            }

            if (!this.allBooks.length) {
                this.statusEl.textContent = "No books found.";
            } else {
                this.statusEl.textContent = `${this.allBooks.length} books loaded.`;
            }
        } catch (e) {
            console.error(e);
            this.statusEl.textContent = "Error while loading books.";
        }
    }

    applyAndRender() {
        let books = [...this.allBooks];

        if (this.longCheckbox.checked) {
            books = books.filter((b) => b.pageCount >= 300);
        }

        const sortBy = this.sortSelect.value;
        if (sortBy === "title") {
            books.sort((a, b) => a.title.localeCompare(b.title));
        } else if (sortBy === "pages") {
            books.sort((a, b) => (b.pageCount || 0) - (a.pageCount || 0));
        }

        if (!books.length) {
            this.statusEl.textContent = "No books with selected filters.";
        } else {
            this.statusEl.textContent = `${books.length} books after filters.`;
        }

        this.renderGrid(books);
    }

    renderGrid(books) {
        this.gridEl.innerHTML = "";

        books.forEach((book) => {
            const card = document.createElement("article");
            card.className = "book-card";

            const cover = document.createElement("img");
            cover.className = "book-cover";
            if (book.thumbnail) {
                cover.src = book.thumbnail;
                cover.alt = book.title;
            }

            const info = document.createElement("div");
            info.className = "book-info";

            const title = document.createElement("div");
            title.className = "book-title";
            title.textContent = book.title;

            const author = document.createElement("div");
            author.className = "book-author";
            author.textContent = book.authors.join(", ");

            info.appendChild(title);
            info.appendChild(author);

            const actions = document.createElement("div");
            actions.className = "book-actions";

            const meta = document.createElement("div");
            meta.className = "book-meta";
            if (book.isAudio) {
                meta.textContent = "Audiobook";
            } else {
                meta.textContent = book.pageCount ? `${book.pageCount} pages` : "Book";
            }

            const buttonsWrap = document.createElement("div");

            const openBtn = document.createElement("button");
            openBtn.className = "book-btn-sm";
            openBtn.textContent = "Details";
            openBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                window.open(
                    "https://books.google.com/books?id=" + book.id,
                    "_blank"
                );
            });

            const favBtn = document.createElement("button");
            favBtn.className = "book-btn-sm book-btn-sm--fav";
            const isFav = this.favoritesStorage.isFavorite(this.favorites, book.id);
            favBtn.textContent = isFav ? "♥" : "♡";
            favBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                this.favorites = this.favoritesStorage.toggle(this.favorites, book);
                this.favoritesStorage.save(this.favorites);
                const nowFav = this.favoritesStorage.isFavorite(
                    this.favorites,
                    book.id
                );
                favBtn.textContent = nowFav ? "♥" : "♡";
            });

            buttonsWrap.appendChild(openBtn);
            buttonsWrap.appendChild(favBtn);

            actions.appendChild(meta);
            actions.appendChild(buttonsWrap);

            card.appendChild(cover);
            card.appendChild(info);
            card.appendChild(actions);

            card.addEventListener("click", () => {
                this.modalManager.open(book);
            });

            this.gridEl.appendChild(card);
        });
    }
}




document.addEventListener("DOMContentLoaded", () => {
    const page = document.body.dataset.page || "home";
    if (page === "home") {
        const app = new LitMateApp();
        app.init();
    } else if (page === "explore") {
        const explore = new ExplorePage();
        explore.init();
    }
});
