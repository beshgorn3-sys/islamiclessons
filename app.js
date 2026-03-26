// ================================================================
// تهيئة Firebase
// ================================================================
const firebaseConfig = {
    apiKey: "AIzaSyCpjKIDFovVT6lhINojXSBphf1YkErqbHQ",
    authDomain: "telgramfiles.firebaseapp.com",
    projectId: "telgramfiles",
    storageBucket: "telgramfiles.firebasestorage.app",
    messagingSenderId: "895894298208",
    appId: "1:895894298208:web:9dcb6f93cfa12d93692d05"
};

// تهيئة Firebase مع معالجة الأخطاء
let db;
try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    console.log('✅ Firebase initialized successfully');
} catch (error) {
    console.error('❌ Firebase initialization error:', error);
}

// ================================================================
// عناصر الواجهة
// ================================================================
const splashScreen = document.getElementById('splash-screen');
const appContainer = document.getElementById('app-container');
const appView = document.getElementById('app-view');
const playerControls = document.getElementById('player-controls');
const currentLessonTitle = document.getElementById('current-lesson-title');
const currentSheikh = document.getElementById('current-sheikh');
const currentLessonImg = document.getElementById('current-lesson-img');
const searchBarContainer = document.getElementById('search-bar-container');
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search');
const playerPrev = document.getElementById('player-prev');
const playerNext = document.getElementById('player-next');
const playerPlayPause = document.getElementById('player-playpause');

// ================================================================
// المتغيرات العامة
// ================================================================
let player = null;
let allData = [];
let currentPlaying = { playlistIndex: -1, lessonIndex: -1, playlistId: null };
let isPlayerReady = false;
let pendingPlay = null;
let retryCount = 0;
const MAX_RETRY = 3;

// ================================================================
// تهيئة مشغل YouTube مع معالجة الأخطاء
// ================================================================
function onYouTubeIframeAPIReady() {
    console.log('🎬 YouTube API Ready');
    try {
        player = new YT.Player('youtube-player', {
            height: '100%',
            width: '100%',
            playerVars: {
                'autoplay': 0,
                'controls': 0,
                'rel': 0,
                'modestbranding': 1,
                'playsinline': 1,
                'enablejsapi': 1,
                'origin': window.location.origin
            },
            events: {
                'onReady': onPlayerReady,
                'onStateChange': onPlayerStateChange,
                'onError': onPlayerError
            }
        });
    } catch (error) {
        console.error('❌ Player creation error:', error);
        showToast('حدث خطأ في تهيئة المشغل', 'error');
    }
}

function onPlayerReady() {
    console.log('✅ Player ready');
    isPlayerReady = true;
    if (pendingPlay) {
        playLesson(pendingPlay.playlistIndex, pendingPlay.lessonIndex);
        pendingPlay = null;
    }
}

function onPlayerError(event) {
    console.error('❌ YouTube Player Error:', event.data);
    
    // معالجة أخطاء YouTube المختلفة
    const errorMessages = {
        2: 'طلب غير صالح',
        5: 'خطأ في الخادم الداخلي',
        100: 'الفيديو غير موجود',
        101: 'لا يمكن تشغيل الفيديو في هذا المتصفح',
        150: 'الفيديو خاص أو محذوف',
        153: 'مشغل YouTube غير مدعوم في هذا المتصفح'
    };
    
    const message = errorMessages[event.data] || 'خطأ في تشغيل الفيديو';
    showToast(message, 'error');
    
    // محاولة تشغيل الدرس التالي عند الخطأ
    if (event.data === 150 || event.data === 101 || event.data === 100) {
        setTimeout(() => playNextLesson(), 1000);
    }
}

function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.PLAYING) {
        const playlist = allData[currentPlaying.playlistIndex];
        if (playlist && playlist.videos[currentPlaying.lessonIndex]) {
            const lesson = playlist.videos[currentPlaying.lessonIndex];
            currentLessonTitle.textContent = lesson.title;
            if (currentSheikh) currentSheikh.textContent = playlist.sheikh;
            updateMediaSession(lesson.title, playlist.sheikh, playlist.series, lesson.videoId);
            updatePlayPauseButton(true);
            
            // تحديث عنوان الصفحة
            document.title = `${lesson.title.substring(0, 30)} - المكتبة الصوتية`;
        }
    } else if (event.data === YT.PlayerState.PAUSED) {
        updatePlayPauseButton(false);
        document.title = 'المكتبة الصوتية';
    } else if (event.data === YT.PlayerState.ENDED) {
        playNextLesson();
    }
}

function updatePlayPauseButton(isPlaying) {
    if (playerPlayPause) {
        const icon = playerPlayPause.querySelector('i');
        if (isPlaying) {
            icon.className = 'fas fa-pause';
            playerPlayPause.title = 'إيقاف مؤقت';
        } else {
            icon.className = 'fas fa-play';
            playerPlayPause.title = 'تشغيل';
        }
    }
}

// ================================================================
// التحكم بالمشغل
// ================================================================
function playLesson(playlistIndex, lessonIndex) {
    if (!isPlayerReady || !player) {
        pendingPlay = { playlistIndex, lessonIndex };
        showToast('جاري تهيئة المشغل...', 'info');
        return;
    }
    
    const playlist = allData[playlistIndex];
    if (!playlist || !playlist.videos[lessonIndex]) {
        showToast('الدرس غير موجود', 'error');
        return;
    }
    
    const lesson = playlist.videos[lessonIndex];
    
    currentPlaying = { playlistIndex, lessonIndex, playlistId: playlist.playlistId };
    
    try {
        player.loadVideoById(lesson.videoId);
        player.playVideo();
    } catch (error) {
        console.error('Play error:', error);
        showToast('حدث خطأ في التشغيل', 'error');
        return;
    }
    
    playerControls.classList.add('visible');
    currentLessonImg.src = `https://i.ytimg.com/vi/${lesson.videoId}/mqdefault.jpg`;
    currentLessonImg.alt = lesson.title;
    
    // تحديث العنصر النشط في القائمة
    document.querySelectorAll('.lesson-item').forEach(el => el.classList.remove('playing'));
    const lessonItem = document.querySelector(`.lesson-item[data-lesson-index='${lessonIndex}']`);
    if (lessonItem) lessonItem.classList.add('playing');
    
    // حفظ آخر درس تم تشغيله
    localStorage.setItem(`lastPlayed_${playlist.playlistId}`, lessonIndex);
    
    showToast(`جاري تشغيل: ${lesson.title.substring(0, 40)}`, 'success');
}

function playNextLesson() {
    if (currentPlaying.playlistIndex === -1) return;
    const nextIndex = currentPlaying.lessonIndex + 1;
    const playlist = allData[currentPlaying.playlistIndex];
    if (playlist && nextIndex < playlist.videos.length) {
        playLesson(currentPlaying.playlistIndex, nextIndex);
        showToast('الدرس التالي', 'info');
    } else {
        showToast('🎉 انتهت السلسلة! بارك الله فيك', 'success');
    }
}

function playPreviousLesson() {
    if (currentPlaying.playlistIndex === -1) return;
    const prevIndex = currentPlaying.lessonIndex - 1;
    if (prevIndex >= 0) {
        playLesson(currentPlaying.playlistIndex, prevIndex);
        showToast('الدرس السابق', 'info');
    } else {
        showToast('هذا هو أول درس في السلسلة', 'info');
    }
}

function togglePlayPause() {
    if (!player) return;
    try {
        if (player.getPlayerState() === YT.PlayerState.PLAYING) {
            player.pauseVideo();
        } else {
            player.playVideo();
        }
    } catch (error) {
        console.error('Toggle play/pause error:', error);
    }
}

// ================================================================
// Media Session API (للتشغيل في الخلفية - يدعم فقط HTTPS)
// ================================================================
function updateMediaSession(title, artist, album, videoId) {
    // فقط في بيئة HTTPS أو localhost
    if ('mediaSession' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost')) {
        try {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: title,
                artist: artist,
                album: album,
                artwork: [
                    { src: `https://i.ytimg.com/vi/${videoId}/default.jpg`, sizes: '120x90', type: 'image/jpeg' },
                    { src: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`, sizes: '320x180', type: 'image/jpeg' },
                    { src: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, sizes: '480x360', type: 'image/jpeg' }
                ]
            });
            
            navigator.mediaSession.setActionHandler('play', () => togglePlayPause());
            navigator.mediaSession.setActionHandler('pause', () => togglePlayPause());
            navigator.mediaSession.setActionHandler('nexttrack', () => playNextLesson());
            navigator.mediaSession.setActionHandler('previoustrack', () => playPreviousLesson());
        } catch (error) {
            console.log('MediaSession not supported in this environment');
        }
    }
}

// ================================================================
// عرض الواجهات
// ================================================================
function showPlaylistsView(filteredData = null) {
    const dataToDisplay = filteredData || allData;
    
    if (!dataToDisplay || dataToDisplay.length === 0) {
        appView.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-book-open"></i>
                <h3>لا توجد سلاسل علمية</h3>
                <p>استخدم لوحة التحكم (admin.html) لإضافة سلاسل جديدة</p>
                <button onclick="window.location.href='admin.html'" class="retry-btn">
                    <i class="fas fa-tools"></i> فتح لوحة التحكم
                </button>
            </div>
        `;
        return;
    }
    
    appView.innerHTML = '<div class="playlists-grid" id="playlists-container"></div>';
    const container = document.getElementById('playlists-container');
    
    dataToDisplay.forEach((playlist, displayIndex) => {
        const originalIndex = allData.findIndex(p => p.playlistId === playlist.playlistId);
        const card = document.createElement('div');
        card.className = 'playlist-card';
        card.style.animationDelay = `${displayIndex * 0.05}s`;
        card.innerHTML = `
            <div class="card-icon">
                <i class="fas fa-chalkboard-user"></i>
            </div>
            <div class="card-content">
                <h3>${escapeHtml(playlist.series)}</h3>
                <p><i class="fas fa-user-tie"></i> ${escapeHtml(playlist.sheikh)}</p>
                <div class="card-footer">
                    <span class="lesson-count"><i class="fas fa-video"></i> ${playlist.videos.length} درس</span>
                </div>
            </div>
        `;
        card.addEventListener('click', () => showLessonsView(originalIndex));
        container.appendChild(card);
    });
}

function showLessonsView(playlistIndex) {
    searchBarContainer.classList.add('hidden');
    const playlist = allData[playlistIndex];
    const lastPlayed = localStorage.getItem(`lastPlayed_${playlist.playlistId}`) || 0;
    
    appView.innerHTML = `
        <div class="lessons-header">
            <button id="back-to-playlists" class="back-btn">
                <i class="fas fa-arrow-right"></i> جميع السلاسل
            </button>
            <div class="series-info">
                <h2>${escapeHtml(playlist.series)}</h2>
                <p class="sheikh-name"><i class="fas fa-user-tie"></i> ${escapeHtml(playlist.sheikh)}</p>
                <p class="total-lessons"><i class="fas fa-video"></i> ${playlist.videos.length} درساً</p>
            </div>
        </div>
        <div class="lessons-list" id="lessons-list"></div>
    `;
    
    const list = document.getElementById('lessons-list');
    
    playlist.videos.forEach((video, lessonIndex) => {
        const lessonItem = document.createElement('div');
        lessonItem.className = 'lesson-item';
        if (lessonIndex == lastPlayed) {
            lessonItem.classList.add('last-played');
        }
        lessonItem.dataset.lessonIndex = lessonIndex;
        lessonItem.innerHTML = `
            <span class="lesson-number">${lessonIndex + 1}</span>
            <span class="lesson-title">${escapeHtml(video.title)}</span>
            <i class="fas fa-play-circle play-icon"></i>
        `;
        lessonItem.addEventListener('click', () => playLesson(playlistIndex, lessonIndex));
        list.appendChild(lessonItem);
    });
    
    document.getElementById('back-to-playlists').addEventListener('click', () => {
        searchBarContainer.classList.remove('hidden');
        showPlaylistsView();
    });
}

// ================================================================
// البحث
// ================================================================
function filterPlaylists(searchTerm) {
    if (!searchTerm) return allData;
    const term = searchTerm.toLowerCase();
    return allData.filter(p => 
        p.series.toLowerCase().includes(term) || 
        p.sheikh.toLowerCase().includes(term)
    );
}

function setupSearch() {
    if (!searchInput) return;
    
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value;
        if (clearSearchBtn) {
            clearSearchBtn.classList.toggle('hidden', !searchTerm);
        }
        const filtered = filterPlaylists(searchTerm);
        showPlaylistsView(filtered);
    });
    
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            searchInput.value = '';
            clearSearchBtn.classList.add('hidden');
            showPlaylistsView(allData);
            searchInput.focus();
        });
    }
}

// ================================================================
// أدوات مساعدة
// ================================================================
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'info') {
    const existingToast = document.querySelector('.toast');
    if (existingToast) existingToast.remove();
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="fas ${type === 'error' ? 'fa-exclamation-circle' : type === 'success' ? 'fa-check-circle' : 'fa-info-circle'}"></i>
        <span>${message}</span>
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }, 10);
}

// ================================================================
// تهيئة التطبيق
// ================================================================
function initializeApp() {
    console.log('🚀 Initializing app...');
    setupSearch();
    
    if (playerPrev) playerPrev.addEventListener('click', () => playPreviousLesson());
    if (playerNext) playerNext.addEventListener('click', () => playNextLesson());
    if (playerPlayPause) playerPlayPause.addEventListener('click', () => togglePlayPause());
    
    // التحقق من Firebase
    if (!db) {
        appView.innerHTML = `
            <div class="error-state">
                <i class="fas fa-database"></i>
                <h3>خطأ في الاتصال بقاعدة البيانات</h3>
                <p>يرجى التحقق من إعدادات Firebase</p>
                <button onclick="location.reload()" class="retry-btn">
                    <i class="fas fa-sync-alt"></i> إعادة المحاولة
                </button>
            </div>
        `;
        splashScreen.classList.add('hidden');
        appContainer.classList.remove('hidden');
        return;
    }
    
    // الاستماع للتغييرات في Firebase
    db.collection("playlists").orderBy("createdAt", "desc").onSnapshot(
        (snapshot) => {
            console.log(`📚 Loaded ${snapshot.size} playlists`);
            allData = snapshot.docs.map(doc => doc.data());
            
            // التحقق من وجود بيانات
            if (allData.length === 0) {
                appView.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-book-open"></i>
                        <h3>مرحباً بك في المكتبة الصوتية</h3>
                        <p>لا توجد سلاسل علمية حالياً</p>
                        <button onclick="window.location.href='admin.html'" class="retry-btn">
                            <i class="fas fa-plus-circle"></i> إضافة سلسلة جديدة
                        </button>
                    </div>
                `;
            } else {
                showPlaylistsView();
            }
            
            splashScreen.classList.add('hidden');
            appContainer.classList.remove('hidden');
            searchBarContainer.classList.remove('hidden');
        },
        (error) => {
            console.error('❌ Firebase Error:', error);
            appView.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-database"></i>
                    <h3>خطأ في الاتصال بقاعدة البيانات</h3>
                    <p>يرجى التحقق من اتصال الإنترنت</p>
                    <button onclick="location.reload()" class="retry-btn">
                        <i class="fas fa-sync-alt"></i> إعادة المحاولة
                    </button>
                </div>
            `;
            splashScreen.classList.add('hidden');
            appContainer.classList.remove('hidden');
        }
    );
}

// بدء التطبيق عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', initializeApp);