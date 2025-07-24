// ==UserScript==
// @name         jiraClockify.user.js
// @namespace    http://tampermonkey.net/
// @version      4.3
// @description  Adds a draggable and minimizable Clockify shortcut panel to Jira tickets.
// @author       Romain Magana
// @match        https://jira.sm360.ca/browse/*
// @connect      api.clockify.me
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_notification
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
    'use strict';

    // --- CONFIGURATION & CONSTANTES (inchangées) ---
    const CLOCKIFY_API_KEY = 'monScriptPerso_clockifyApiKey';
    const globalData = {
      "inventory": { "id": "638d3c7e50bdbe7c334a673c", "task": { "analysis": "638d3c8050bdbe7c334a6743", "programming": "638d3c8050bdbe7c334a6742" }},
      "crm": { "id": "638d3ac550bdbe7c334a6057", "task": { "analysis": "638d3ac650bdbe7c334a605d", "programming": "638d3ac650bdbe7c334a605c" }},
      "website": { "id": "638d3d74a581104ca1a4a6d3", "task": { "analysis": "638d3d76a581104ca1a4a6db", "programming": "638d3d76a581104ca1a4a6da" }}
    };

    // --- FONCTIONS UTILITAIRES (inchangées) ---
    async function setupConfiguration() { /* ... */ }
    function apiRequest(options) { /* ... */ }
    function extractText(selector) { /* ... */ }
    async function handleClockifyClick(data) { /* ... */ }

    // --- MISE À JOUR DE L'INTERFACE DU PANNEAU ---

    function createShortcutPanel(variables) {
        const style = document.createElement('style');
        style.textContent = `
            .shortcut-section {
                position: fixed; bottom: 20px; right: 20px;
                background-color: #ffffff;
                border: 1px solid #ddd;
                box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                border-radius: 8px;
                z-index: 1000;
                user-select: none; /* Empêche la sélection de texte pendant le drag */
            }
            .shortcut-header {
                padding: 8px 12px;
                cursor: move; /* Curseur pour indiquer qu'on peut déplacer */
                background-color: #f7f7f7;
                border-bottom: 1px solid #ddd;
                border-radius: 8px 8px 0 0;
                position: relative;
            }
            .shortcut-header h3 {
                margin: 0; font-size: 14px; color: #333;
            }
            .shortcut-content {
                padding: 15px;
                transition: all 0.2s ease;
            }
            .shortcut-item { display: flex; align-items: center; }
            .shortcut-name { color: #333; width: 80px; font-weight: bold; }
            .shortcut-button { margin-right: 5px; border-radius: 4px; border: none; color: white; padding: 8px 12px; cursor: pointer; }
            .button-clockify { background-color:#03A9F4; }
            /* Styles pour le mode réduit */
            .shortcut-minimized .shortcut-content {
                display: none;
            }
            .shortcut-minimized {
                padding: 0;
            }
        `;
        document.head.appendChild(style);

        const panel = document.createElement('div');
        panel.className = 'shortcut-section';
        panel.innerHTML = `
            <div class="shortcut-header">
                <h3>Raccourcis Clockify</h3>
            </div>
            <div class='shortcut-content'>
                <div class="shortcut-item">
                    <p class="shortcut-name">Temps:</p>
                    <div>
                        <button class="shortcut-button button-clockify" data-time="15">15min</button>
                        <button class="shortcut-button button-clockify" data-time="30">30min</button>
                        <button class="shortcut-button button-clockify" data-time="60">60min</button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(panel);

        const header = panel.querySelector('.shortcut-header');

        // --- LOGIQUE POUR RÉDUIRE/RESTAURER ---
        header.addEventListener('dblclick', function() {
            panel.classList.toggle('shortcut-minimized');
        });

        // --- LOGIQUE POUR DÉPLACER (DRAG AND DROP) ---
        header.addEventListener('mousedown', function(e) {
            e.preventDefault();

            // Calcul de la position initiale du curseur par rapport au panneau
            let offsetX = e.clientX - panel.offsetLeft;
            let offsetY = e.clientY - panel.offsetTop;

            function mouseMoveHandler(e) {
                // Met à jour la position du panneau
                panel.style.left = (e.clientX - offsetX) + 'px';
                panel.style.top = (e.clientY - offsetY) + 'px';
                // On supprime bottom/right pour que top/left prennent le dessus
                panel.style.bottom = 'auto';
                panel.style.right = 'auto';
            }

            function mouseUpHandler() {
                // On arrête d'écouter les mouvements de la souris
                document.removeEventListener('mousemove', mouseMoveHandler);
                document.removeEventListener('mouseup', mouseUpHandler);
            }

            // On attache les écouteurs au document entier pour un déplacement fluide
            document.addEventListener('mousemove', mouseMoveHandler);
            document.addEventListener('mouseup', mouseUpHandler);
        });

        // Attacher les écouteurs pour les boutons d'action
        panel.querySelectorAll('.shortcut-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const time = e.target.dataset.time;
                handleClockifyClick({ ...variables, time });
            });
        });
    }

    // --- POINT D'ENTRÉE ET AUTRES FONCTIONS (inchangées) ---

    async function setupConfiguration() {
        let clockifyKey = await GM_getValue(CLOCKIFY_API_KEY);
        if (!clockifyKey || clockifyKey.trim() === '') {
            clockifyKey = prompt("CLÉ API CLOCKIFY MANQUANTE\n\nVeuillez entrer votre clé API Clockify :");
            if (clockifyKey && clockifyKey.trim() !== '') {
                await GM_setValue(CLOCKIFY_API_KEY, clockifyKey);
                GM_notification({ title: 'Configuration terminée', text: 'Clé API Clockify enregistrée.', timeout: 3000 });
                return clockifyKey;
            }
        }
        return clockifyKey;
    }

    function apiRequest(options) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: options.method,
                url: options.url,
                headers: options.headers,
                data: options.data ? JSON.stringify(options.data) : null,
                responseType: 'json',
                onload: (response) => {
                    if (response.status >= 200 && response.status < 300) resolve(response.response);
                    else reject(new Error(`[${response.status}]`));
                },
                onerror: (error) => reject(error)
            });
        });
    }

    function extractText(selector) {
        const element = document.querySelector(selector);
        return element ? element.textContent.trim() : null;
    }

    async function handleClockifyClick(data) {
        try {
            let clockifyKey = await setupConfiguration();
            if (!clockifyKey) {
                alert("Action annulée. Une clé API Clockify est nécessaire.");
                return;
            }

            if (!data.dealerId) {
                alert("Erreur: 'Dealer ID' non trouvé sur la page Jira. Impossible de chercher le tag Clockify.");
                return;
            }

            const tags = await apiRequest({
                method: 'GET',
                url: `https://api.clockify.me/api/v1/workspaces/62a1d8a2fd729b7c57b405fa/tags?name=${data.dealerId}`,
                headers: { 'x-api-key': clockifyKey }
            });

            const clientTag = tags.find(tag => tag.name.startsWith(data.dealerId));

            if (!clientTag) {
                alert(`Erreur: Aucun tag trouvé dans Clockify pour le Dealer ID "${data.dealerId}".`);
                return;
            }

            const task = data.taskType?.toLowerCase().includes('website') ? globalData.website :
                         data.taskType?.toLowerCase().includes('crm') ? globalData.crm : globalData.inventory;
            if (!data.taskType) {
                alert("Erreur: 'Task Type' (ou 'Component') non trouvé sur la page Jira.");
                return;
            }

            const isBug = data.ticketType?.toLowerCase().includes('bug');
            const taskId = isBug ? task.task.analysis : task.task.programming;

            const timeEntryData = {
                description: `[${data.ticketId}]: ${data.ticketName}`,
                projectId: task.id,
                taskId: taskId,
                tagIds: [clientTag.id],
                start: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
                end: new Date(new Date().getTime() + parseInt(data.time) * 60000).toISOString().replace(/\.\d{3}Z$/, 'Z'),
            };

            await apiRequest({
                method: 'POST',
                url: 'https://api.clockify.me/api/v1/workspaces/62a1d8a2fd729b7c57b405fa/time-entries',
                headers: { 'x-api-key': clockifyKey, 'Content-Type': 'application/json' },
                data: timeEntryData
            });
            GM_notification({ title: "Clockify", text: `${data.time} minutes ajoutées pour ${data.ticketId}` });

        } catch (error) {
            console.error(`Erreur lors de l'action Clockify:`, error);
            GM_notification({ title: `Erreur Clockify`, text: `L'API a retourné une erreur. Erreur: ${error.message}` });
        }
    }

    window.addEventListener('load', function() {
        setTimeout(() => {
            const variables = {
                dealerId: extractText('#customfield_10800-field'),
                ticketId: extractText('a#key-val'),
                groupId: extractText('#customfield_11302-field'),
                ticketName: extractText('h1#summary-val'),
                ticketType: extractText('span#type-val'),
                taskType: extractText('div#customfield_17504-val') || extractText('span#components-val')
            };
            if (variables.ticketId) {
                createShortcutPanel(variables);
            }
        }, 1500);
    });

    GM_registerMenuCommand('Configurer/Changer la clé API Clockify', setupConfiguration);
})();
