// ==UserScript==
// @name         FaB Decklist Scraper
// @version      0.1
// @description  Scrape decklist from all players for an event manually using a button on the standings page.
// @author       Maxwell Taylor
// @match        https://fabtcg.com/en/coverage/pro-tour-london/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const navigationDelay = 500;

    const isStandingsPage = window.location.pathname.startsWith('/en/coverage/pro-tour-london/standings/');
    const isDecklistPage = window.location.pathname.startsWith('/en/coverage/pro-tour-london/decklist/');


    if (isStandingsPage && localStorage.getItem('scrapeInProgress') !== 'true') {
        injectScrapeButton();
    }

    if (localStorage.getItem('scrapeInProgress') === 'true' && isStandingsPage) {
        console.log('Starting scraping...');
        setTimeout(navigateToDecklistViewLink, navigationDelay);
        return;
    }

    if (localStorage.getItem('scrapeInProgress') === 'true' && isDecklistPage) {
        console.log('Resuming scraping...');
        setTimeout(scrapeDecklistData, navigationDelay);
        return;
    }

    function injectScrapeButton() {
        const nameHeader = document.querySelector('h2');
        if (!nameHeader)
            console.log("No name header")

        if (!nameHeader) return;

        const wrapper = document.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.alignItems = 'center';
        wrapper.style.justifyContent = 'space-between';

        const button = document.createElement('button');
        button.textContent = 'Start Decklist Export';
        button.style.fontSize = '14px';
        button.style.padding = '6px 10px';
        button.style.marginLeft = '20px';
        button.style.backgroundColor = '#d4af37';
        button.style.color = '#000';
        button.style.border = 'none';
        button.style.borderRadius = '4px';
        button.style.cursor = 'pointer';
        button.style.boxShadow = '0 1px 4px rgba(0,0,0,0.3)';

        button.addEventListener('click', () => {
            localStorage.setItem('allEventData', JSON.stringify([]));
            localStorage.setItem('scrapeInProgress', 'true');
            localStorage.setItem('lastRankProcessed', '501');
            navigateToDecklistViewLink();
        });

        nameHeader.parentElement.insertBefore(wrapper, nameHeader);
        wrapper.appendChild(nameHeader);
        wrapper.appendChild(button);
    }

    // Helper function to convert a string to camelCase
    function toCamelCase(str) {
        return str
        .split(/[\s-_]+/)
        .map((word, index) => {
            if (index === 0) return word.toLowerCase();
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join('');
    }
  

    function scrapeDecklistData() {
        const currentRank = Number(localStorage.getItem('lastRankProcessed')) + 1

        let allEventData = JSON.parse(localStorage.getItem('allEventData')) || [];

        const tables = document.querySelectorAll("table");
        if (!tables.length) {
        console.warn("No tables found on the page.");
        return;
        }

        // Object that will store our final JSON structure.
        let result = {};

        // Process the first table into "playerInfo".
        let playerInfo = {};
        tables[0].querySelectorAll("tr").forEach(row => {
        const cells = row.querySelectorAll("th, td");
        if (cells.length >= 2) {
            const key = cells[0].innerText.trim();
            const value = cells[1].innerText.trim();
            playerInfo[key] = value;
        }
        });
        result["playerInfo"] = playerInfo;

        // Create decklist object to nest all subsequent tables.
        let decklist = {};

        // Process each remaining table.
        for (let i = 1; i < tables.length; i++) {
        const table = tables[i];
        const rows = table.querySelectorAll("tr");
        if (rows.length === 0) continue;

        // Use the first row (header row) to derive the key.
        const headerCells = rows[0].querySelectorAll("th, td");
        let headerText = Array.from(headerCells)
            .map(cell => cell.innerText.trim())
            .join(" ");
        const tableKey = toCamelCase(headerText);

        // Process each data row (skip the header row).
        let tableData = [];
        for (let j = 1; j < rows.length; j++) {
            let row = rows[j];
            // Combine all cell values with a comma separator.
            let rowText = Array.from(row.querySelectorAll("td"))
            .map(cell => cell.innerText.trim())
            .join(", ");
            // Only add non-empty rows.
            if (rowText.length > 0) {
            tableData.push(rowText);
            }
        }
        decklist[tableKey] = tableData;
        }

        result["decklist"] = decklist;
        result.decklist.decklistLink = window.location.href;

        // Save this to the local storage object
        allEventData.push(result);
        
        // Save the updated array back to localStorage.
        localStorage.setItem("allEventData", JSON.stringify(allEventData));
        
        console.log(`Decklist ${currentRank} data has been stored successfully in localStorage.`);
        
        console.log("Incrementing and navigating back");
        localStorage.setItem('lastRankProcessed', `${currentRank}`);
        setTimeout(() => history.back(), navigationDelay);
    }

    function navigateToDecklistViewLink() {
        let currentRank = Number(localStorage.getItem('lastRankProcessed')) + 1
        console.log(`About to process rank ${currentRank} decklist...`)
        const firstRow = document.querySelector('.table-block').querySelector('tr');
        let next = firstRow;
        let counter = 0
        while (counter < currentRank){
            next = next?.nextElementSibling;
            counter++;
        }

        let link = next?.querySelector('a');
        
        // skip missing decklists
        while (next && !link) {
            console.log("No decklist for this rank.")
            localStorage.setItem('lastRankProcessed', `${currentRank}`);
            currentRank++;
            next = next?.nextElementSibling
            link = next?.querySelector('a')
        }

        if (next && link) {
            localStorage.setItem('lastRankProcessed', `${currentRank}`);
            console.log(`Navigating to rank ${currentRank} decklist...`);
            setTimeout(() => {
                window.location.href = link.href;
            }, navigationDelay);
        } else {
            console.log('Reached last decklist. Saving JSON...');
            localStorage.setItem('scrapeInProgress', 'false');
            saveDataToJSON();
            localStorage.removeItem('allEventData');
        }
    }

    function saveDataToJSON() {
        const allEventData = JSON.parse(localStorage.getItem('allEventData')) || [];

        // Trigger download of the JSON file.
        const jsonBlob = new Blob([JSON.stringify(allEventData, null, 2)], { type: 'application/json;charset=utf-8;' });
        const url = URL.createObjectURL(jsonBlob);
        const downloadLink = document.createElement("a");
        downloadLink.href = url;
        downloadLink.download = "decklists.json";
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);

        console.log('Scraped data saved to JSON.');
    }
})();
