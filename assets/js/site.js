/* Small progressive-enhancement layer for 暮土 · Terra Dusk */
(() => {
  /* nav: solid once the hero starts leaving */
  const nav = document.querySelector('.nav');
  const onScroll = () => {
    if (nav) nav.classList.toggle('is-scrolled', window.scrollY > 24);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* compact nav menu on small screens */
  const toggle = document.querySelector('.nav__toggle');
  if (nav && toggle) {
    const panel = document.getElementById('nav-links');
    const setOpen = (open) => {
      nav.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
    };
    toggle.addEventListener('click', () => setOpen(!nav.classList.contains('is-open')));
    panel?.addEventListener('click', (event) => {
      if (event.target.closest('a')) setOpen(false);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') setOpen(false);
    });
    document.addEventListener('click', (event) => {
      if (!event.target.closest('.nav')) setOpen(false);
    });
  }

  /* Yunnan clock (UTC+8, no daylight saving) */
  const clocks = document.querySelectorAll('[data-clock]');
  if (clocks.length) {
    const fmt = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const tick = () => {
      const value = fmt.format(new Date());
      clocks.forEach((el) => (el.textContent = value));
    };
    tick();
    setInterval(tick, 15000);
  }

  /* time of day: warms the palette at dawn and dusk, cools it after dark */
  const skyWords = { dawn: '晨', day: '昼', dusk: '暮', night: '夜' };
  const sky = document.querySelector('[data-sky]');
  const markPhase = () => {
    const hour = Number(
      new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Shanghai', hour: '2-digit', hour12: false }).format(
        new Date()
      )
    );
    const phase =
      hour >= 5 && hour < 7 ? 'dawn' : hour >= 7 && hour < 16 ? 'day' : hour >= 16 && hour < 19 ? 'dusk' : 'night';
    const root = document.documentElement;
    if (root.dataset.phase === phase) return;
    root.dataset.phase = phase;
    if (sky) sky.textContent = skyWords[phase] + ' · 18°C';
  };
  markPhase();
  setInterval(markPhase, 60000);

  /* reveal on scroll */
  const revealables = document.querySelectorAll('[data-reveal]');
  if (revealables.length) {
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-in');
              io.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
      );
      revealables.forEach((el) => io.observe(el));
    } else {
      revealables.forEach((el) => el.classList.add('is-in'));
    }
  }

  /* tag filter on the index */
  const filters = document.querySelectorAll('[data-filter]');
  const posts = document.querySelectorAll('.post[data-tag]');
  if (filters.length && posts.length) {
    filters.forEach((button) => {
      button.addEventListener('click', () => {
        const value = button.dataset.filter;
        filters.forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
        posts.forEach((post) => {
          post.hidden = value !== 'all' && post.dataset.tag !== value;
        });
      });
    });
  }

  /* reading progress on article pages */
  const bar = document.querySelector('.progress span');
  if (bar) {
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      bar.style.transform = `scaleX(${p})`;
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
  }
})();
