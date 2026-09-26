# लसीकरण ड्यू लिस्ट संकलन (ASHA Vaccination Due List) — v2

सार्वजनिक आरोग्य विभाग, महाराष्ट्र शासन
प्राथमिक आरोग्य केंद्र: देहरे | उपकेंद्र: वडगाव गुप्ता

React + Vite + Tailwind CSS 4 + Supabase ॲप — आशा सेविका आणि आरोग्य सेवक
(प्रशासक) यांच्यासाठी बालके व गरोदर मातांच्या लसीकरण नोंदी.

## वैशिष्ट्ये

- **आशा सेविका लॉगिन:** नाव निवडून ४ अंकी पिनने जलद लॉगिन (Supabase anonymous auth)
- **प्रशासक लॉगिन:** ईमेल + पासवर्ड (Supabase Auth) — Gmail बंधन नाही
- **आशा व्यवस्थापन (नवीन):** प्रशासक पॅनेलमधून आशा सेविका **जोडा / काढा**, प्रत्येकीचा पिन बदला
- **नोंदणी:** बालक / गरोदर माता, जन्मतारीख-LMP वरून लसींची ऑटो-शिफारस, सत्र तारीख निवड
- **अहवाल:** लाईन लिस्ट, मासिक ॲबस्ट्रॅक्ट (चार्टसह), आशा-वाईज अहवाल
- **एक्सपोर्ट:** Excel (XLSX) आणि PDF डाउनलोड
- **रिअल-टाइम:** एका फोनवर केलेली नोंद दुसऱ्या फोनवर लगेच दिसते
- **PWA:** मोबाईलवर ॲपसारखे इंस्टॉल करता येते, ॲनिमेटेड आधुनिक डिझाइन

## सेटअप

प्रथम **`SETUP.md`** वाचा — Supabase मध्ये ३ छोट्या पायऱ्या (SQL फाईल, anonymous
sign-in, admin user). त्यानंतर:

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build -> dist/
```

## वातावरण (Environment)

`.env` मध्ये (आधीच भरलेले आहे):

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-key
```

## डेटाबेस स्कीमा

`supabase-setup.sql` पहा. दोन टेबल:

- `asha_workers(id, name, pin, created_at)` — RLS: वाचण्यासाठी सर्व signed-in
  वापरकर्ते; लिहिण्यासाठी फक्त ईमेल-लॉगिन प्रशासक
- `vaccine_records(id, asha_id, asha_name, record_type, patient_name,
  reference_date, session_date, vaccines[], remark, created_at)` — RLS: सर्व
  signed-in वापरकर्त्यांसाठी पूर्ण प्रवेश

## प्रकल्प रचना

```
src/
  App.tsx                  # Auth shell, login screen, header
  supabase.ts              # Supabase client + anonymous session
  db.ts                    # Typed queries/mappers + realtime subscriptions
  types.ts / utils.ts      # Models, vaccine lists, recommenders
  components/
    AshaDashboard.tsx      # Worker entry UI
    AdminDashboard.tsx      # Reports + ASHA management
    ui.tsx                 # Animated primitives (tabs, modal, toast helpers)
    Toast.tsx              # Toast notifications
    PWAInstallButton.tsx
```

## परवाना

खाजगी प्रकल्प — देहरे PHC वापरासाठी.
