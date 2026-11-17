'use strict';
// Fallback values, used when a settings group is missing or a field is empty.
module.exports = {
  general: {
    brand_name: 'Socialdia Agency', brand_short: 'Socialdia',
    tagline_ar: 'إحنا مش بننشر.. إحنا بنؤدي', tagline_en: "We don't post.. we perform",
    country_ar: 'مصر', country_en: 'Egypt',
    logo: '/assets/logo.jpg', logo_mark: '/assets/logo-mark.jpg',
    footer_text_ar: '', footer_text_en: '', copyright: '© Socialdia Agency',
  },
  contact: { whatsapp: '', phone: '', email: '', address_ar: '', address_en: '', hours_ar: '', hours_en: '', map_url: '' },
  social: { instagram: '', facebook: '', tiktok: '', youtube: '', linkedin: '', x: '', behance: '', snapchat: '', telegram: '' },
  theme: { accent: '#D6065F', accent_dark: '#FF5C9E', pop: '#FFEB6E', sky: '#A8DDE9', violet: '#B04BB5', leaf: '#5DAA73' },
  features: { intro: 'session', enable_3d: true, effects: true, whatsapp_button: true, theme_toggle: true, lang_toggle: true, default_lang: 'ar', default_theme: 'system', scene_bar: true },
  seo: { title_ar: 'Socialdia Agency', title_en: 'Socialdia Agency', desc_ar: '', desc_en: '', og_image: '/assets/logo.jpg', site_url: '', index: true },
  code: { head: '', body_end: '', css: '' },
  announcement: { enabled: false, text_ar: '', text_en: '', url: '' },
  home: {
    hero_slate: 'Title card', hero_reel: 'Reel 2026',
    hero_title_ar: 'كل نجاح وراه حكاية. [[بنحكيها معاك]] من أول فكرة.',
    hero_title_en: 'Every success has a story. [[We tell it with you,]] from the first idea.',
    hero_lede_ar: '', hero_lede_en: '', hero_cta_ar: 'ابدأ الحكاية', hero_cta_en: 'Start the story',
    stats: [],
    credits_title_ar: 'الخدمات اللي ورا كل مشهد.', credits_title_en: 'The services behind every scene.',
    finale_title_ar: 'عندك فكرة؟ خلّينا نصوّر المشهد الأول.', finale_title_en: "Got an idea? Let's shoot scene one.",
    finale_btn_ar: 'تواصل معانا', finale_btn_en: 'Contact us', finale_btn_url: '/contact',
    finale_btn2_ar: 'ارجع لأول الحكاية', finale_btn2_en: 'Back to the start',
  },
};
