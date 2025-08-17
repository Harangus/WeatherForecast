const API_KEY = '7836864239393d702c3c6e68a39360aa';  //OpenWeatherMap API key

// Handles city name autocompletion logic
class Autocomplete {
    constructor(inputId, suggestionsId, onSelect, data) {
        this.input = document.getElementById(inputId); //search input element
        this.suggestions = document.getElementById(suggestionsId); //suggestions dropdown element
        this.data = data; //list of all cities
        this.maxResults = 10;
        this.onSelect = onSelect; //callback when city is chosen
        this.init();
    }

    // listening for typing input
    init() {
        this.input.addEventListener('input', () => this.onInput());
    }

    // called when user is typing
    onInput() {
        const query = this.input.value.toLowerCase();
        this.clearSuggestions();
        if (!query) return;

        // find matching cities
        const matches = this.data
            .filter(city => city.name.toLowerCase().startsWith(query))
            .slice(0, this.maxResults);

        matches.forEach(city => this.addSuggestion(city));
        this.suggestions.style.display = matches.length ? 'block' : 'none';
    }

    // add sugestion item to dropdown   
    addSuggestion(city) {
        const li = document.createElement('li');
        li.textContent = `${city.name}, ${city.country}`;
        li.addEventListener('click', () => {
            this.input.value = city.name;
            this.clearSuggestions();
            this.onSelect(city.coord.lat, city.coord.lon); // Pass coords to the app
        });
        this.suggestions.appendChild(li);
    }

    // clear all suggestions items
    clearSuggestions() {
        this.suggestions.innerHTML = '';
        this.suggestions.style.display = 'none';
    }
}

// Main weather app logic
class WeatherApp {
    constructor(chartId, dateId, descId, tempId, daysListId, detailsId) {
        this.dailyData = {}; // stores forecast data by type
        this.chartInstance = null; // Chart.js instance
        this.chartId = chartId;
        this.dateId = dateId;
        this.descId = descId;
        this.tempId = tempId;
        this.daysListId = daysListId;
        this.detailsId = detailsId;

        // Locale from browser
        this.locale = navigator.language ||(navigator.languages && navigator.languages[0]) || 'en-US';
        this.tzOffsetSec = 0;

        this.fmtDay = new Intl.DateTimeFormat(this.locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC'});
        this.fmtTime = new Intl.DateTimeFormat(this.locale, { hour: '2-digit', minute: '2-digit', timeZone: 'UTC'});
        this.fmtFull = new Intl.DateTimeFormat(this.locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'});
    }

    localDateFromUnix(dtSec) {
        const ms = (dtSec + this.tzOffsetSec) * 1000;
        return new Date(ms);
    }

    dayKeyFromUnix(dtSec) {
        const d = this.localDateFromUnix(dtSec);
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2,'0');
        const dd = String(d.getUTCDate()).padStart(2,'0');
        return `${y}-${m}-${dd}`;
    }

    // Fetch forecast from OpenWeatherMap
    fetchForecast(lat, lon) {
        fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=cz`)
            .then(res => res.json())
            .then(data => {
                this.dailyData = {};
                this.tzOffsetSec = data.city?.timezone ?? 0;
                // group forecast data by day
                data.list.forEach(item => {
                    const key = this.dayKeyFromUnix(item.dt); //local day
                    if (!this.dailyData[key]) this.dailyData[key] = [];
                    this.dailyData[key].push(item);
                });

                // show first day by default
                const firstDay = Object.keys(this.dailyData)[0];
                this.showDay(firstDay);
                this.renderDaysList();
            })
            .catch(err => console.error(err));
    }

    // display chosen day
    showDay(dateKey) {
        const dayData = this.dailyData[dateKey];
        if (!dayData) return;

        const temps = dayData.map(x => x.main.temp);
        const avgTemp = (temps.reduce((sum, x) => sum + x, 0) / temps.length).toFixed(1);

        const tMin = Math.min(...temps);
        const tMax = Math.max(...temps);

        const midday = dayData[Math.floor(dayData.length / 2)];
        const description = midday.weather[0].description;
        const icon = midday.weather[0].icon;

        document.getElementById(this.descId).innerHTML =
        `<img class="weather-icon" src="http://openweathermap.org/img/wn/${icon}@2x.png" alt="icon"> ${description}`;
        document.getElementById(this.tempId).innerText = `Průměrná teplota: ${avgTemp} °C`;

        this.showDetails({
            ...midday,
            main: {
                ...midday.main,
                temp_min: tMin,
                temp_max: tMax
            }
        });

        const labels = dayData.map(x => this.fmtTime.format(this.localDateFromUnix(x.dt)));
        const icons = dayData.map(x => x.weather[0].icon);

        this.drawChart(labels, temps, icons);
    }


    // render clickable list of next 5 days
    renderDaysList() {
        const daysList = document.getElementById(this.daysListId);
        daysList.innerHTML = '';

        Object.keys(this.dailyData).slice(0, 5).forEach(dateKey => {
        const sample = this.dailyData[dateKey][0];
        const d = this.localDateFromUnix(sample.dt);
        const label = this.fmtDay.format(d); // např. „po 19. 8.“

        const btn = document.createElement('button');
        btn.textContent = label;
        btn.className = 'day-button';

        btn.addEventListener('click', () => {
            document.querySelectorAll('.day-button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            this.showDay(dateKey);
        });

        daysList.appendChild(btn);
        });

        // rovnou zvýrazni první
        const first = daysList.querySelector('.day-button');
        if (first) first.classList.add('active');
    }


    // show more detailed weather info
    showDetails(dp) {
        const windDir = deg => {
            // convert wind degree to compass direction
            const dirs = ['S','SV','V','JV','J','JZ','Z','SZ','S'];
            return dirs[Math.round(((deg % 360) / 45))];
        };
        const safe = (v, fallback = '—') => (v === undefined || v === null ? fallback : v);

        // extract details from forecast object
        const map = {
            feels:  dp.main?.feels_like !== undefined ? `${dp.main.feels_like} °C`:'—',
            tmin:   dp.main?.temp_min   !== undefined ? `${dp.main.temp_min} °C`: '—',
            tmax:   dp.main?.temp_max   !== undefined ? `${dp.main.temp_max} °C`: '—',
            hum:    dp.main?.humidity   !== undefined ? `${dp.main.humidity} %`:'—',
            pres:   dp.main?.pressure   !== undefined ? `${dp.main.pressure} hPa`:'—',
            windS:  dp.wind?.speed      !== undefined ? `${dp.wind.speed} m/s`:'—',
            windG:  dp.wind?.gust       !== undefined ? `${dp.wind.gust} m/s`:'—',
            windD:  dp.wind?.deg        !== undefined ? `${dp.wind.deg}° (${windDir(dp.wind.deg)})`:'—',
            clouds: dp.clouds?.all      !== undefined ? `${dp.clouds.all} %`:'—',
            vis:    dp.visibility       !== undefined ? `${Math.round(dp.visibility/1000)} km`:'—',
            rain3h: dp.rain?.['3h']     !== undefined ? `${dp.rain['3h']} mm/3h`:'—',
            snow3h: dp.snow?.['3h']     !== undefined ? `${dp.snow['3h']} mm/3h`:'—'
        };

        //rendering into DOM
        for (const [id, value] of Object.entries(map)) {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        }
    }

    // draw temperature chart
    drawChart(labels, data, icons) {
        const ctx = document.getElementById(this.chartId).getContext('2d');
        if (this.chartInstance) this.chartInstance.destroy();

        this.chartInstance = new Chart(ctx, {
            type: 'line',
            data: { 
                labels: labels,
                datasets: [{
                    label: 'Teplota °C',
                    data: data,
                    borderColor: 'orange',
                    fill: false,
                    pointRadius: 6
                }]
            },
            options: { 
                responsive: true,
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: (context) => `🌡 ${context.parsed.y} °C`,
                        }
                    },
                    legend: {
                        labels: {
                            color: 'white'
                        }
            }
                },
                maintainAspectRatio: false,
                scales: { 
                    y: {
                         beginAtZero: false,
                         ticks: { color: 'white'}
                    },

                    x: {
                        ticks: { color: 'white'}
                    }
                }
            }
        });
    }
}

// load city list, init app + autocomplete
fetch('../city.list.json')
    .then(response => response.json())
    .then(cities => {
        const app = new WeatherApp('temp-chart', 'today-date', 'today-desc', 'today-temp', 'days-list', 'details');
        new Autocomplete('city-input', 'suggestions', (lat, lon) => app.fetchForecast(lat, lon), cities);
    });
