export const api = {
    async googleLogin(credential) {
        const res = await fetch('/api/google-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential })
        });
        return await res.json();
    },

    async login(email, password) {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        return await res.json();
    },

    async signup(name, email, password) {
        const res = await fetch('/api/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });
        return await res.json();
    },

    async updateProfile(user_id, name, company, services) {
        const res = await fetch('/api/update-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id, name, company, services })
        });
        return await res.json();
    },

    async startPipeline(url, context, thread_id, user_id, user_name, user_company, user_services, gmail_access_token = "") {
        const res = await fetch('/api/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, context, thread_id, user_id, user_name, user_company, user_services, gmail_access_token })
        });
        return await res.json();
    },

    async handleAction(thread_id, action, edited_email, gmail_access_token = "") {
        const res = await fetch('/api/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ thread_id, action, edited_email, gmail_access_token })
        });
        return await res.json();
    },

    async saveDraftToGmail(subject, body) {
        const res = await fetch('/api/save_draft_to_gmail', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subject, body })
        });
        return await res.json();
    },

    async getHistory(user_id) {
        const res = await fetch(`/api/history/${user_id}`);
        return await res.json();
    }
};
