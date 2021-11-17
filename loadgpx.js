///////////////////////////////////////////////////////////////////////////////
// loadgpx.4.js
//
// Javascript object to load GPX-format GPS data into Google Maps.
//
// Copyright (C) 2006 Kaz Okuda (http://notions.okuda.ca)
//
// This program is free software; you can redistribute it and/or
// modify it under the terms of the GNU General Public License
// as published by the Free Software Foundation; either version 2
// of the License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program; if not, write to the Free Software
// Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
//
// If you use this script or have any questions please leave a comment
// at http://notions.okuda.ca/geotagging/projects-im-working-on/gpx-viewer/
// A link to the GPL license can also be found there.
//
///////////////////////////////////////////////////////////////////////////////
//
// History:
//    revision 1 - Initial implementation
//    revision 2 - Removed LoadGPXFileIntoGoogleMap and made it the callers
//                 responsibility.  Added more options (colour, width, delta).
//    revision 3 - Waypoint parsing now compatible with Firefox.
//    revision 4 - Upgraded to Google Maps API version 2.  Tried changing the way
//               that the map calculated the way the center and zoom level, but
//               GMAP API 2 requires that you center and zoom the map first.
//               I have left the bounding box calculations commented out in case
//               they might come in handy in the future.
//
//    5/28/2010 - Upgraded to Google Maps API v3 and refactored the file a bit.
//                          (Chris Peplin)
//
// Author: Kaz Okuda
// URI: http://notions.okuda.ca/geotagging/projects-im-working-on/gpx-viewer/
//
// Updated for Google Maps API v3 by Chris Peplin
// Fork moved to GitHub: https://github.com/peplin/gpxviewer
//
///////////////////////////////////////////////////////////////////////////////

function GPXParser(xmlDoc, map) {
    this.xmlDoc = xmlDoc;
    this.map = map;
    this.trackcolour = "#ff00ff"; // red
    this.trackwidth = 5;
    this.mintrackpointdelta = 0.0001;
    this.timeOffset = 3;
    this.polyLineArray = [];
    this.mobileMarks = {}
    this.trkColors = [];
    this.tracks = {};
    this.markSize = parseFloat(gpx_trainer_mark_scale);

    const name_prefix = 'red_triangle_';
    const name_ext = '.png';
    this.customIconPath = '/static/images';
    this.iconSizes = {
       10: {name: name_prefix + '80x72' + name_ext, width: 80, height: 72, anchor: {x: 40, y: 36}, origin: {x: 0, y: 0}},
        9: {name: name_prefix + '70x63' + name_ext, width: 70, height: 63, anchor: {x: 35, y: 33}, origin: {x: 0, y: 0}},
        8: {name: name_prefix + '60x54' + name_ext, width: 60, height: 54, anchor: {x: 30, y: 27}, origin: {x: 0, y: 0}},
        7: {name: name_prefix + '50x45' + name_ext, width: 50, height: 45, anchor: {x: 25, y: 23}, origin: {x: 0, y: 0}},
        6: {name: name_prefix + '40x36' + name_ext, width: 40, height: 36, anchor: {x: 20, y: 18}, origin: {x: 0, y: 0}},
        5: {name: name_prefix + '30x27' + name_ext, width: 30, height: 27, anchor: {x: 15, y: 19}, origin: {x: 0, y: 0}},
        4: {name: name_prefix + '26x23' + name_ext, width: 26, height: 23, anchor: {x: 18, y: 12}, origin: {x: 0, y: 0}},
        3: {name: name_prefix + '20x18' + name_ext, width: 20, height: 18, anchor: {x: 10, y:  9}, origin: {x: 0, y: 0}},
        2: {name: name_prefix + '14x13' + name_ext, width: 14, height: 13, anchor: {x:  7, y:  7}, origin: {x: 0, y: 0}},
        1: {name: name_prefix + '8x7'   + name_ext, width: 8,  height:  7, anchor: {x:  4, y:  4}, origin: {x: 0, y: 0}}
    }
}

// Set the colour of the track line segements.
GPXParser.prototype.setTrackColour = function (colour) {
    this.trackcolour = colour;
}

// Set the width of the track line segements
GPXParser.prototype.setTrackWidth = function (width) {
    this.trackwidth = width;
}

// Set the minimum distance between trackpoints.
// Used to cull unneeded trackpoints from map.
GPXParser.prototype.setMinTrackPointDelta = function (delta) {
    this.mintrackpointdelta = delta;
}

GPXParser.prototype.translateName = function (name) {
    if (name == "wpt") {
        return "Waypoint";
    } else if (name == "trkpt") {
        return "Track Point";
    } else if (name == "rtept") {
        return "Route Point";
    }
}


GPXParser.prototype.createMarker = function (point) {
    //console.log("createMarker sourceMap: ", sourcesMap)
    var lon = parseFloat(point.getAttribute("lon"));
    var lat = parseFloat(point.getAttribute("lat"));
    var html = "";

    var pointElements = point.getElementsByTagName("html");
    if (pointElements.length > 0) {
        for (let i = 0; i < pointElements.item(0).childNodes.length; i++) {
            html += pointElements.item(0).childNodes[i].nodeValue;
        }
    } else {
        // Create the html if it does not exist in the point.
        html = "<b>" + this.translateName(point.nodeName) + "</b><br>";
        var attributes = point.attributes;
        var attrlen = attributes.length;
        for (i = 0; i < attrlen; i++) {
            html += attributes.item(i).name + " = " +
                attributes.item(i).nodeValue + "<br>";
        }

        if (point.hasChildNodes) {
            var children = point.childNodes;
            var childrenlen = children.length;
            for (i = 0; i < childrenlen; i++) {
                // Ignore empty nodes
                if (children[i].nodeType != 1) continue;
                if (children[i].firstChild == null) continue;
                html += children[i].nodeName + " = " +
                    children[i].firstChild.nodeValue + "<br>";
            }
        }
    }
    let size = this.markSize || 5;

    if (!this.markSize || !this.iconSizes.hasOwnProperty(size)) {
        size = 6;
    }

    var marker = new google.maps.Marker({
        position: new google.maps.LatLng(lat, lon),
        map: this.map,
        icon: {
            url: `${this.customIconPath}/${this.iconSizes[size].name}`,
            size: new google.maps.Size(this.iconSizes[size].width, this.iconSizes[size].height),
            origin: new google.maps.Point(this.iconSizes[size].origin.x, this.iconSizes[size].origin.y),
            anchor: new google.maps.Point(this.iconSizes[size].anchor.x, this.iconSizes[size].anchor.y),
        }
    });

    var infowindow = new google.maps.InfoWindow({
        content: html,
        size: new google.maps.Size(50, 50)
    });

    google.maps.event.addListener(marker, "click", function () {
        if (infowindow.getMap()) {
            infowindow.close();
        } else {
            infowindow.open(this.map, marker);
        }
    });
}

GPXParser.prototype.getData = async function () {
    let res = []

    const timeOffset = this.xmlDoc.documentElement.getElementsByTagName("metadata");
    if (timeOffset[0]) {
        const desc = timeOffset[0].getElementsByTagName('desc')
        if (desc[0]) {
            const descInner = desc[0].innerHTML;
            this.timeOffset = descInner.split("=")[1]
        }
    }

    const trk = this.xmlDoc.documentElement.getElementsByTagName("trk");
    for (let j = 0; j < trk.length; j++) {
        const result = {};
        const colorTag = trk[j].getElementsByTagName("gpxx:DisplayColor")[0];
        const colorValue = colorTag.innerHTML;
        this.trkColors.push(colorValue);
        const trackPoint = trk[j].getElementsByTagName("trkpt");
        const extension = trk[j].getElementsByTagName("gpxtpx:TrackPointExtension");
        for (let i = 0; i < extension.length; i++) {
            const position = {
                lon: trackPoint[i].getAttribute('lon'),
                lat: trackPoint[i].getAttribute('lat'),
            };
            const param = trackPoint[i]
            const timeSrc = new Date(param.getElementsByTagName('time')[0]?.innerHTML);

            const desc = param.getElementsByTagName('desc')[0]?.innerHTML;
            const color = desc?.split(',')[1].slice(0, -1);

            const speedId = extension[i].getElementsByTagName('gpxtpx:speed');
            const directionId = extension[i].getElementsByTagName('gpxtpx:direction');
            const heelId = extension[i].getElementsByTagName('gpxtpx:heel');

            const speed = speedId ? parseFloat(speedId[0]?.innerHTML).toFixed(2) : 0;
            const direction = directionId ? parseFloat(directionId[0]?.innerHTML).toFixed(0) : 0;
            const heel = heelId ? parseFloat(heelId[0]?.innerHTML).toFixed(0) : 0;

            const hours = ('0' + timeSrc.getUTCHours()).slice(-2);
            const minutes = ('0' + timeSrc.getUTCMinutes()).slice(-2);
            const seconds = ('0' + timeSrc.getUTCSeconds()).slice(-2);

            const time_string = `${hours}:${minutes}:${seconds}`;
            const time_key = 60 * +hours * 60 + 60 * +minutes + +seconds;

            const offset = 0;
            result[time_string] = {
                index: i + offset,
                speed,
                direction,
                heel,
                time: time_string,
                time_sec: time_key,
                time_src: timeSrc,
                position
            }
            if (!!color) {
                this.mobileMarks[time_string] = {
                    color,
                    time: time_string,
                    position
                }
            }
        }
        res.push(result)
    }
    return res;
}

GPXParser.prototype.addTrackSegmentToMap = function (trackSegment, colour, width) {
    var trackpoints = trackSegment.getElementsByTagName("trkpt");
    if (trackpoints.length == 0) {
        return;
    }

    var pointarray = [];

    // process first point
    var lastlon = parseFloat(trackpoints[0].getAttribute("lon"));
    var lastlat = parseFloat(trackpoints[0].getAttribute("lat"));
    var latlng = new google.maps.LatLng(lastlat, lastlon);
    pointarray.push(latlng);

    for (var i = 1; i < trackpoints.length; i++) {
        var lon = parseFloat(trackpoints[i].getAttribute("lon"));
        var lat = parseFloat(trackpoints[i].getAttribute("lat"));

        // Verify that this is far enough away from the last point to be used.
        var latdiff = lat - lastlat;
        var londiff = lon - lastlon;
        if (Math.sqrt(latdiff * latdiff + londiff * londiff)
            > this.mintrackpointdelta) {
            lastlon = lon;
            lastlat = lat;
            latlng = new google.maps.LatLng(lat, lon);
            pointarray.push(latlng);
        }

    }

    var polyline = new google.maps.Polyline({
        path: pointarray,
        strokeColor: colour,
        strokeWeight: width,
        map: this.map
    });
    this.polyLineArray.push(polyline)
}

GPXParser.prototype.addTrackToMap = function (track, colour, width) {
    var segments = track.getElementsByTagName("trkseg");
    for (var i = 0; i < segments.length; i++) {
        var segmentlatlngbounds = this.addTrackSegmentToMap(segments[i], colour, width);
    }
}

GPXParser.prototype.addRouteToMap = function (route, colour, width) {
    var routepoints = route.getElementsByTagName("rtept");
    if (routepoints.length == 0) {
        return;
    }

    var pointarray = [];

    // process first point
    var lastlon = parseFloat(routepoints[0].getAttribute("lon"));
    var lastlat = parseFloat(routepoints[0].getAttribute("lat"));
    var latlng = new google.maps.LatLng(lastlat, lastlon);
    pointarray.push(latlng);

    for (var i = 1; i < routepoints.length; i++) {
        var lon = parseFloat(routepoints[i].getAttribute("lon"));
        var lat = parseFloat(routepoints[i].getAttribute("lat"));

        // Verify that this is far enough away from the last point to be used.
        var latdiff = lat - lastlat;
        var londiff = lon - lastlon;
        if (Math.sqrt(latdiff * latdiff + londiff * londiff)
            > this.mintrackpointdelta) {
            lastlon = lon;
            lastlat = lat;
            latlng = new google.maps.LatLng(lat, lon);
            pointarray.push(latlng);
        }

    }

    var polyline = new google.maps.Polyline({
        path: pointarray,
        strokeColor: colour,
        strokeWeight: width,
        map: this.map
    });
}

GPXParser.prototype.centerAndZoom = function (trackSegment) {

    var pointlist = new Array("trkpt", "rtept", "wpt");
    var minlat = 0;
    var maxlat = 0;
    var minlon = 0;
    var maxlon = 0;

    for (var pointtype = 0; pointtype < pointlist.length; pointtype++) {

        // Center the map and zoom on the given segment.
        var trackpoints = trackSegment.getElementsByTagName(
            pointlist[pointtype]);

        // If the min and max are uninitialized then initialize them.
        if ((trackpoints.length > 0) && (minlat == maxlat) && (minlat == 0)) {
            minlat = parseFloat(trackpoints[0].getAttribute("lat"));
            maxlat = parseFloat(trackpoints[0].getAttribute("lat"));
            minlon = parseFloat(trackpoints[0].getAttribute("lon"));
            maxlon = parseFloat(trackpoints[0].getAttribute("lon"));
        }

        for (var i = 0; i < trackpoints.length; i++) {
            var lon = parseFloat(trackpoints[i].getAttribute("lon"));
            var lat = parseFloat(trackpoints[i].getAttribute("lat"));

            if (lon < minlon) minlon = lon;
            if (lon > maxlon) maxlon = lon;
            if (lat < minlat) minlat = lat;
            if (lat > maxlat) maxlat = lat;
        }
    }

    if ((minlat == maxlat) && (minlat == 0)) {
        this.map.setCenter(new google.maps.LatLng(49.327667, -122.942333), 14);
        return;
    }

    // Center around the middle of the points
    var centerlon = parseFloat((maxlon + minlon) / 2);
    var centerlat = parseFloat((maxlat + minlat) / 2);

    var bounds = new google.maps.LatLngBounds(
        new google.maps.LatLng(minlat, minlon),
        new google.maps.LatLng(maxlat, maxlon));
    this.map.setCenter(new google.maps.LatLng(centerlat, centerlon));
    this.map.fitBounds(bounds);
}

GPXParser.prototype.centerAndZoomToLatLngBounds = function (latlngboundsarray) {
    var boundingbox = new google.maps.LatLngBounds();
    for (var i = 0; i < latlngboundsarray.length; i++) {
        if (!latlngboundsarray[i].isEmpty()) {
            boundingbox.extend(latlngboundsarray[i].getSouthWest());
            boundingbox.extend(latlngboundsarray[i].getNorthEast());
        }
    }

    var centerlat = (boundingbox.getNorthEast().lat() +
        boundingbox.getSouthWest().lat()) / 2;
    var centerlng = (boundingbox.getNorthEast().lng() +
        boundingbox.getSouthWest().lng()) / 2;
    this.map.setCenter(new google.maps.LatLng(centerlat, centerlng),
        this.map.getBoundsZoomLevel(boundingbox));
}

GPXParser.prototype.addTrackpointsToMap = function () {
    var tracks = this.xmlDoc.documentElement.getElementsByTagName("trk");
    for (var i = 0; i < tracks.length; i++) {
        var trk_color = this.xmlDoc.documentElement.getElementsByTagName("gpxx:DisplayColor")[i];
        if (trk_color) {
            $(trk_color[0]).on('click', function () {
                console.log('click')
            })
            this.setTrackColour(trk_color.innerHTML);
        }
        this.addTrackToMap(tracks[i], this.trackcolour, this.trackwidth);
    }
}

GPXParser.prototype.addWaypointsToMap = function () {
    var waypoints = this.xmlDoc.documentElement.getElementsByTagName("wpt");
    for (var i = 0; i < waypoints.length; i++) {
        this.createMarker(waypoints[i]);
    }
}

GPXParser.prototype.addRouteFlagsToMap = function () {
    console.log('loadgpx sources', sourcesMap);
}

GPXParser.prototype.addRoutepointsToMap = function () {
    var routes = this.xmlDoc.documentElement.getElementsByTagName("rte");
    for (var i = 0; i < routes.length; i++) {
        this.addRouteToMap(routes[i], this.trackcolour, this.trackwidth);
    }
}
