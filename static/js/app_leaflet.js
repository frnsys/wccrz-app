var map;

function getEverything() {
  $.getJSON('/api/heatmap_all', function(data) {
    var heatMapData = data.map(function(datum) {
      var coords = Geohash.decode(datum[0]);
      return [coords.lat, coords.lon, datum[1]]
    });
    var heat = L.heatLayer(heatMapData, {
      radius: 45,
      minOpacity: .3,
      gradient: {0.4: 'yellow', 0.65: 'orange', .8: 'red'}
    }).addTo(map);
  });
}

function loadGeoJSON() {
  $.getJSON('/static/crimes.geojson', function(data) {
    console.log(data.features[0]);
    L.geoJSON(data.features).addTo(map);
  });
}

var w = $(window).width()

map = L.map('map',{
  zoomControl: false,
  zoomAnimation: false,
  fadeAnimation: false,
  attributionControl: false,
  keyboardPanDelta: w
// }).setView([40.7215259, -74.0129994], 9);
}).setView([49.384358, -124.848974], 9);


var mapsat = L.tileLayer('https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/256/{z}/{x}/{y}?access_token=pk.eyJ1Ijoic3BsYXZpZ25lIiwiYSI6ImNpejFzZGx2NDAxbW0zM21uaGE5czI2cWkifQ.6p_ecnp-5wUHJeRm0kxKxQ', {
  attributionControl: false,
});

var sat = L.tileLayer('http://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
  attributionControl: false,
});

// sat.addTo(map);

var extra = L.tileLayer('http://{s}.tile.openstreetmap.se/hydda/roads_and_labels/{z}/{x}/{y}.png', {
  attributionControl: false,
});

var Stamen_TonerLite = L.tileLayer('http://stamen-tiles-{s}.a.ssl.fastly.net/toner-lite/{z}/{x}/{y}.{ext}', {
	subdomains: 'abcd',
	minZoom: 0,
	maxZoom: 20,
	ext: 'png'
});

mapsat.addTo(map);

// extra.addTo(map);

// loadGeoJSON();
getEverything();
