var map;
var marker;
var polygons = [];
var currentHashes = [], oldHashes = [];
var timeout;
var heatmap;
var clickIndicator;

var grayscaleStyle = [{"elementType":"geometry","stylers":[{"color":"#f5f5f5"}]},{"elementType":"labels.icon","stylers":[{"visibility":"off"}]},{"elementType":"labels.text.fill","stylers":[{"color":"#616161"}]},{"elementType":"labels.text.stroke","stylers":[{"color":"#f5f5f5"}]},{"featureType":"administrative.land_parcel","elementType":"labels.text.fill","stylers":[{"color":"#bdbdbd"}]},{"featureType":"poi","elementType":"geometry","stylers":[{"color":"#eeeeee"}]},{"featureType":"poi","elementType":"labels.text.fill","stylers":[{"color":"#757575"}]},{"featureType":"poi.park","elementType":"geometry","stylers":[{"color":"#e5e5e5"}]},{"featureType":"poi.park","elementType":"labels.text.fill","stylers":[{"color":"#9e9e9e"}]},{"featureType":"road","elementType":"geometry","stylers":[{"color":"#ffffff"}]},{"featureType":"road.arterial","elementType":"labels.text.fill","stylers":[{"color":"#757575"}]},{"featureType":"road.highway","elementType":"geometry","stylers":[{"color":"#dadada"}]},{"featureType":"road.highway","elementType":"labels.text.fill","stylers":[{"color":"#616161"}]},{"featureType":"road.local","elementType":"labels.text.fill","stylers":[{"color":"#9e9e9e"}]},{"featureType":"transit.line","elementType":"geometry","stylers":[{"color":"#e5e5e5"}]},{"featureType":"transit.station","elementType":"geometry","stylers":[{"color":"#eeeeee"}]},{"featureType":"water","elementType":"geometry","stylers":[{"color":"#c9c9c9"}]},{"featureType":"water","elementType":"labels.text.fill","stylers":[{"color":"#9e9e9e"}]}];

var type_colors = d3.map({
 'BREACH OF FIDUCIARY DUTY': '#F70076',
 'CHURNING': '#F70076',
 'FRAUD': '#F70076',
 'MANIPULATION': '#F70076',
 'MISREPRESENTATION': '#F70076',
 'OMISSION OF FACTS': '#F70076',
 'SUITABILITY': '#F70076',
 'UNAUTHORIZED TRADING': '#F70076',
 'BREACH OF CONTRACT': '#F400BB',
 'ACCOUNT RELATED - COLLECTION': '#F400BB',
 'ACCOUNT RELATED - DIVIDENDS': '#F400BB',
 'ACCOUNT RELATED - ERROR CHARGE': '#F400BB',
 'ACCOUNT RELATED - EXCHANGE': '#F400BB',
 'FAILURE TO SUPERVISE': '#F400BB',
 'MARGIN CALL': '#F400BB',
 'NEGLIGENCE': '#F400BB',
 'ACCOUNT RELATED-TRANSFER': '#F400BB',
 'EMPLOYMENT DISCRIMINATION BASED ON AGE': '#FF4800',
 'EXECUTIONS-EXECUTION PRICE': '#CD00FF',
 'FAILURE TO EXECUTE': '#CD00FF',
 'EXECUTIONS-LIMIT V MRKT ORDR': '#CD00FF',
 'FAILURE OF DUE DILIGENCE': '#F2000C',
 'FAILURE TO PAY': '#F2000C',
 'FAILURE TO REPORT OR INCORRECT REPORTING': '#F2000C',
 'FAILURE TO RESPOND TO FINRA': '#F2000C',
 'IMPROPER CHARGE': '#FF4800',
 'INACCURATE DATA': '#FF4800',
 'INCORRECT MARK': '#FF4800',
 'OPERATING WITHOUT LICENSE OR IMPROPER LICENSE': '#FF4800',
 'OTHER': '#FF4800',
 'DEFAMATION': '#FF4800',
 'RULE VIOLATION': '#FF4800',
 'BUY IN TRADING DISPUTE': '#A100FF',
 'MANIPULATION TRADING DISPUTE': '#A100FF',
 'MARK UP TRADING DISPUTE': '#A100FF',
 'TRANSFER TRADING DISPUTE': '#A100FF',
 'UNETHICAL BUSINESS PRACTICES': '#FF4800'
});

var descriptions = {};

var fine_bins = [
  '$0 - $10,000',
  '$10,000 - $100,000',
  '$100,000 - $500,000',
  '$500,000 - $1,000,000',
  '$1,000,000 - $5,000,000',
  '$5,000,000 - $10,000,000',
  '$10,000,000 - $100,000,000',
  '$100,000,000+'
];

var color1 = '#fff645';
var color2 = '#ff0000';
var color_scale = d3.interpolateCubehelix(color1, color2);
var percent_format = d3.format(',.2%');

var gradient = Array.apply(0, Array(10))
  .map(function(i, e) {
    return e === 0 ? 'rgba(255, 240, 169, 0)'
                   : color_scale(e / 10);
  });

function toTitleCase(str) {
  return str.replace(/\w\S*/g, function(txt){
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
}


function compare(a,b) {
  return a.likelihood < b.likelihood ? 1
       : a.likelihood > b.likelihood ? -1
       : 0;
}


function clearPolylines(hashes) {
  if (hashes) {
    for (var i = polygons.length-1; i >= 0; i--) {
      if (hashes.indexOf(polygons[i].hash) === -1) {
        polygons[i].setMap(null);
      }
    }

  } else {
    for (var i = polygons.length-1; i >= 0; i--) {
      polygons[i].setMap(null);
    }
    polygons = [];
  }
}


// CREATE MAP ----------------------------------------------------------------

map = new GMaps({
  div: '#map',
  lat: 40.75833369736604,
  lng: -73.99591931691897,
  zoom: 14,
  streetViewControl: false,
  zoomControl: true,
  zoomControlOptions: {
    position: google.maps.ControlPosition.RIGHT_BOTTOM
  },
  mapTypeControlOptions: {
    style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
    position: google.maps.ControlPosition.BOTTOM_CENTER
  },
  mapType: 'hybrid'
});

// map.addStyle({
//     styledMapName:"Styled Map",
//     styles: grayscaleStyle,
//     mapTypeId: "grayscale"
// });
//
// map.setStyle("grayscale");

makeHeatMap();


// API CALLS ----------------------------------------------------------------

function getEverything(bounds) {
  var bounding_box = {
    n: bounds.getNorthEast().lat(),
    s: bounds.getSouthWest().lat(),
    w: bounds.getSouthWest().lng(),
    e: bounds.getNorthEast().lng()
  };
  $.getJSON('/api/risks', bounding_box)
    .success(function(data) {
      currentHashes = data.map(function(d) { return d.h; });

      clearPolylines(currentHashes);

      data.forEach(function(datum){
        if (oldHashes.indexOf(datum.h) > -1) return;

        var bbox = Geohash.bounds(datum.h);
        var coords = {
          n: bbox.ne.lat,
          e: bbox.ne.lon,
          s: bbox.sw.lat,
          w: bbox.sw.lon
        };
        makePolyline([
          [coords.s, coords.w],
          [coords.n, coords.w],
          [coords.n, coords.e],
          [coords.s, coords.e]
        ], datum);
      });

      oldHashes = currentHashes;
    })
    .error(function(error) {
      console.error(error);
    });
}


function makeHeatMap() {
  $.getJSON('/api/heatmap', function(data) {
    var heatMapData = [];
    data.forEach(function(datum){
      var coords = Geohash.decode(datum[0]);
      var item = {
        location: new google.maps.LatLng(coords.lat, coords.lon),
        weight: datum[1] * 10
      };
      heatMapData.push(item);
    });
    heatmap = new google.maps.visualization.HeatmapLayer({
      data: heatMapData,
      maxIntensity: 100,
      gradient: gradient
    });
  });
}


function getDetails(geohash) {
  window.location.hash = geohash;
  $('#status').show();
  $('#details').hide();
  $('#description').hide();

  $.getJSON('/api/details', {geohash: geohash}, function(data){
    $('#crime_threat_data').show();
    populate_top_crime_fields(data);
  });
}


// function createClickIndicator(path) {
//   if (clickIndicator) {
//     clickIndicator.setMap(null);
//     clickIndicator = null;
//   }
//
//   clickIndicator = map.drawPolygon({
//     paths: path,
//     strokeColor: 'black',
//     strokeOpacity: 1,
//     strokeWeight: 1,
//     fillColor: 'black',
//     fillOpacity: 1.0,
//   });
//
// }

// DRAW ON THE MAP ----------------------------------------------------------------

function makePolyline(path, data) {
  var color = d3.color(color_scale(data.p));
  color.opacity = data.p + 0.1;
  var poly = map.drawPolygon({
    paths: path,
    strokeColor: 'gray',
    strokeOpacity: 0.8,
    strokeWeight: 1,
    fillColor: color,
    fillOpacity: 0.7,
    click: function(e) {
      getDetails(data.h);
      placeMarker(e.latLng.lat(), e.latLng.lng());
      show_pulse(e);
      // createClickIndicator(path);
    }
  });
  poly.hash = data.h;
  polygons.push(poly);
}


function show_pulse(e) {
  // e = e.ya;
  // if ($('.pulse')) {
  //   remove_pulse();
  // }
  // var clickObj = d3.select('#map')
  //   .append('div')
  //   .style('position', 'absolute')
  //   .style('top', e.clientY + "px")
  //   .style('left', e.clientX + "px");
  // clickObj.append('div')
  //   .attr('class', 'pulse');
}


function remove_pulse() {
  $('.dot').remove();
  $('.pulse').remove();
}


function placeMarker(lat, lng) {
  if (!marker) {
    marker = map.addMarker({
      lat: lat,
      lng: lng
    });
  } else {
    var latLng = new google.maps.LatLng(lat, lng);
    marker.setPosition(latLng);
  }
}


// SIDEBAR ----------------------------------------------------------------

$('#locate').submit(function(e) {
  e.preventDefault();
  GMaps.geocode({
    address: $('#address').val().trim(),
    callback: function(results, status) {
      if (status == 'OK') {
        var latlng = results[0].geometry.location;
        centerAndMark(latlng.lat(), latlng.lng());
      } else if (status == 'ZERO_RESULTS') {}
    }
  });
});


function centerAndMark(lat, lng) {
  map.setCenter(lat, lng);
  map.map.setZoom(14);
  placeMarker(lat, lng);
}


function create_top_crimes_chart(data) {
  var html = [];
  var div_width = $('#crime_threat_data').width();
  data.top.sort(compare).forEach(function(d, i) {
    if (d.p > 0) {
      var crime = type_colors.keys()[d.i];
      var percent = data.crime * d.p;
      var bar_width = percent * div_width;
      var color = d3.color(type_colors.get(crime));
      var c_1 = color.toString();
      var c_2 = color;
      c_2.opacity = 0.3;
      c_2 = c_2.toString();
      var background_gradient_style = 'background: '+ c_1 +';'+
      'background: -moz-linear-gradient(top, '+ c_1 +' 0%, '+ c_1 +' 13%, '+ c_2 +' 100%);'+
      'background: -webkit-gradient(left top, left bottom, color-stop(0%, '+ c_1 +'), color-stop(13%, '+ c_1 +'), color-stop(100%, '+ c_2 +'));'+
      'background: -webkit-linear-gradient(top, '+ c_1 +' 0%, '+ c_1 +' 13%, '+ c_2 +' 100%);'+
      'background: -o-linear-gradient(top, '+ c_1 +' 0%, '+ c_1 +' 13%, '+ c_2 +' 100%);'+
      'background: -ms-linear-gradient(top, '+ c_1 +' 0%, '+ c_1 +' 13%, '+ c_2 +' 100%);'+
      'background: linear-gradient(to bottom, '+ c_1 +' 0%, '+ c_1 +' 13%, '+ c_2 +' 100%);'+
      "filter: progid:DXImageTransform.Microsoft.gradient( startColorstr='#ff0000', endColorstr='#ff0000', GradientType=0 );";
      var h = '<div class="horizontal_bar" style="width:'+ bar_width +'px;'+ background_gradient_style +'"></div>'+
              '<p class="likelihood_text">'+ crime +' <span class="def" data-crime="'+crime+'">?</span><br>'+
              '  <strong>('+ percent_format(percent) +')</strong>'+
              '</p>';
      html.push(h);
    }
  });
  $('#crime_threat_data').html(html.join(''));
}


function populate_top_crime_fields(data) {
  $('#details').show();
  $('#status').hide();
  create_faces(data.suspects);
  create_top_crimes_chart(data);
  create_severity_graph(data.fine_bins, fine_bins, 270, 250);
  create_suspect_list(data.organizations);
}

function create_faces(suspects) {
  if (suspects.length > 0) {
    $('#faces').show();
    var $vid = $('<video src="'+suspects[0].replace('.png', '.mp4').replace('http://', 'https://')+'"></video>');
    $vid.hide();
    $vid.on('loadeddata', function(e){
      $vid.fadeIn(function(){
        $vid[0].play();
      });
    });
    $('#face_comp').css({minHeight: 275}).html($vid);
  } else {
    $('#faces').hide();
  }
}


function create_suspect_list(orgs) {
  $('#suspect_data').html(
    orgs.map(function(org){
      return '<li><a target="_blank" href="https://www.google.com/maps/place/'+org[0]+'/@'+org[1]+','+org[2]+',21z">' + org[0] + '</a></li>';
    }).join('')
  );

  if (orgs.length === 0) {
    $('#suspect_data').html('None found');
  }
}


function create_severity_graph(data, fine_bins, w, h) {
  var margin = {top: 10, right: 50, bottom: 100, left: 40};
  var width  = w - margin.left - margin.right;
  var height = h - margin.top - margin.bottom;

  var x = d3.scaleBand()
    .domain(fine_bins)
    .rangeRound([0, width])
    .padding(0.1);

  var y = d3.scaleLinear()
    .domain([0, 1])
    .rangeRound([height, 0]);

  d3.select("#crime_severity_data")
    .select('svg')
    .remove();

  var svg = d3.select('#crime_severity_data')
    .append('svg')
    .attr('width', w)
    .attr('height', h);

  var g = svg.append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  var gradient = svg.append("defs")
    .append("linearGradient")
    .attr("id", "gradient")
    .attr("x1", "0%")
    .attr("y1", "0%")
    .attr("x2", "0%")
    .attr("y2", "100%")
    .attr("spreadMethod", "pad");

  gradient.append("stop")
    .attr("offset", "0%")
    .attr("stop-color", "#ff0000")
    .attr("stop-opacity", 1);

  gradient.append("stop")
    .attr("offset", "100%")
    .attr("stop-color", "#400000")
    .attr("stop-opacity", 1);

  g.append("g")
    .attr("class", "axis axis--x")
    .attr("transform", "translate(0," + height + ")")
    .call(d3.axisBottom(x).ticks(5))
    .selectAll("text")
    .attr("y", 4)
    .attr("x", 7)
    .attr("transform", "rotate(45)")
    .style("text-anchor", "start");

  g.append("g")
    .attr("class", "axis axis--y")
    .call(d3.axisLeft(y).ticks(5, "%"))
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", 6)
    .attr("dy", "0.71em")
    .attr("text-anchor", "end")
    .text("Frequency");

  var viz_g = g.append('g');

  // ADDS GRAY BACKGROUND AND GRIDLINES ---------------------
  viz_g.append('rect')
    .attr('class', 'bg-rect')
    .attr('x', 0)
    .attr('y', 0)
    .attr('width', width)
    .attr('height', height)
    .style('fill', 'gray');
  viz_g.append("g")
    .attr("class", "grid")
    .attr("transform", "translate(0," + height + ")")
    .call(d3.axisBottom(x)
      .ticks(5)
      .tickSize(-height)
      .tickFormat("")
    );
  viz_g.append("g")
    .attr("class", "grid")
    .call(d3.axisLeft(y)
      .ticks(5)
      .tickSize(-width)
      .tickFormat("")
    );
    // ------------------------------------------------------

  viz_g.selectAll(".bar")
    .data(data).enter()
    .append("rect")
    .attr("class", "bar")
    .attr("x", function(d,i){ return x(fine_bins[i]); })
    .attr("y", function(d){ return y(d); })
    .attr("width", x.bandwidth())
    .attr("height", function(d){ return height - y(d); })
    .style("fill", "url(#gradient)");
}


$('#face_comp').on('click', 'video', function(e){
  $(this)[0].pause();
  $(this)[0].currentTime = '0';
  $(this)[0].play();
});

$('#crime_threat_data').on('click', '.def', function(e){
  var c = $(this).data('crime');
  var def = descriptions[c].description;
  $('#details').hide()
  $('#description').show().find('.content').html('<h2>'+c+'</h2>' + def);
});

$('#close-button').on('click', function(e){
  e.preventDefault();
  $('#details').show();
  $('#description').hide();
});


// GOOGLE MAP EVENTS ----------------------------------------------------------

google.maps.event.addListener(map.map, "zoom_changed", function() {
  remove_pulse();
});

var oldZoom;

google.maps.event.addListener(map.map, "bounds_changed", function() {
  // send the new bounds back to your server
  remove_pulse();
  clearTimeout(timeout);
  var zoom = map.map.getZoom();

  if (zoom > 12) {
    timeout = setTimeout(function() {
      if (heatmap) heatmap.setMap(null);
      getEverything(map.map.getBounds());
    }, 500);
  } else {
    currentHashes = [];
    oldHashes = [];
    clearPolylines();
    if (heatmap && oldZoom != zoom) heatmap.setMap(map.map);
  }

  oldZoom = zoom;
});


$.getJSON('/static/descriptions.json', function(data){
  descriptions = data;
});

if (window.location.hash) {
  var hash = window.location.hash.replace('#', '');
  try {
    var coords = Geohash.decode(hash); 
    centerAndMark(coords.lat, coords.lon);
    getDetails(hash);
  } catch(error) {
    console.log(error);
  }
} else {
  GMaps.geolocate({
    success: function(position) {
      centerAndMark(position.coords.latitude, position.coords.longitude);
    },
    error: function(error) {
      console.log(error);
    },
    not_supported: function() {},
    always: function() {}
  });
}

if( /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ) {
  $('#mobile-overlay').show();
}
