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
    }

    // Fetch forecast from OpenWeatherMap
    fetchForecast(lat, lon) {
        fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`)
            .then(res => res.json())
            .then(data => {
                this.dailyData = {};
                // group forecast data by day
                data.list.forEach(item => {
                    const date = item.dt_txt.split(' ')[0];
                    if (!this.dailyData[date]) this.dailyData[date] = [];
                    this.dailyData[date].push(item);
                });

                // show first day by default
                const firstDay = Object.keys(this.dailyData)[0];
                this.showDay(firstDay);
                this.renderDaysList();
            })
            .catch(err => console.error(err));
    }

    // display chosen day
    showDay(date) {
        const dayData = this.dailyData[date];
        if (!dayData) return;

        // average temp for the day
        const avgTemp = (dayData.reduce((sum, x) => sum + x.main.temp, 0) / dayData.length).toFixed(1);
        const midday = dayData[Math.floor(dayData.length / 2)];
        const description = midday.weather[0].description;
        const icon = midday.weather[0].icon;

        // update top info
        document.getElementById(this.dateId).innerText = date;
        document.getElementById(this.descId).innerHTML =
            `<img src="http://openweathermap.org/img/wn/${icon}.png" alt="icon"> ${description}`;
        document.getElementById(this.tempId).innerText = `Average temperature: ${avgTemp} °C`;

        // prepare chart data
        const labels = dayData.map(x => x.dt_txt.split(' ')[1].slice(0,5));
        const temps = dayData.map(x => x.main.temp);
        const icons = dayData.map(x => x.weather[0].icon);

        this.drawChart(labels, temps, icons);

        this.showDetails(midday); // show extra details
    }

    // render clickable list of next 5 days
    renderDaysList() {
        const daysList = document.getElementById(this.daysListId);
        daysList.innerHTML = '';
        Object.keys(this.dailyData).slice(0,5).forEach(date => {
            const btn = document.createElement('button');
            btn.textContent = date;
            btn.addEventListener('click', () => this.showDay(date));
            daysList.appendChild(btn);
        });
    }

    // show more detailed weather info
    showDetails(dp) {
        const details = document.getElementById(this.detailsId);
        const windDir = deg => {
            // convert wind degree to compass direction
            const dirs = ['N','NE','E','SE','S','SW','W','NW','N'];
            return dirs[Math.round(((deg % 360) / 45))];
        };
        const safe = (v, fallback = '—') => (v === undefined || v === null ? fallback : v);

        // extract details from forecast object
        const feels = safe(dp.main?.feels_like);
        const tmin  = safe(dp.main?.temp_min);
        const tmax  = safe(dp.main?.temp_max);
        const hum   = safe(dp.main?.humidity);
        const pres  = safe(dp.main?.pressure);
        const windS = safe(dp.wind?.speed);
        const windG = safe(dp.wind?.gust);
        const windD = dp.wind?.deg !== undefined ? `${dp.wind.deg}° (${windDir(dp.wind.deg)})` : '—';
        const clouds = safe(dp.clouds?.all);
        const vis   = dp.visibility !== undefined ? Math.round(dp.visibility/1000) + ' km' : '—';
        const rain3h = dp.rain?.['3h'] !== undefined ? `${dp.rain['3h']} mm/3h` : '—';
        const snow3h = dp.snow?.['3h'] !== undefined ? `${dp.snow['3h']} mm/3h` : '—';

        //rendering into DOM
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
                    label: 'Temperature °C',
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
                            label: (context) => `🌡 ${context.parsed.y} °C`
                        }
                    }
                },
                scales: { y: { beginAtZero: false } }
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
