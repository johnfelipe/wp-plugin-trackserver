var Trackserver = (function () {

    return {

        mapdata: {},
        mydata: {},
        timer: false,
        adminmap: false,

        Mapicon: L.Icon.extend({
            options: {
                iconSize:     [15, 15],
                iconAnchor:   [8, 8],
                popupAnchor:  [0, 8]
            }
        }),

        init: function (mapdata) {
            this.mapdata = mapdata;
            this.create_maps();
        },

        get_mydata: function(div_id, track_id, prop) {
            if (this.mydata.hasOwnProperty(div_id)) {
                if (this.mydata[div_id].hasOwnProperty(track_id)) {
                    if (this.mydata[div_id][track_id].hasOwnProperty(prop)) {
                        return this.mydata[div_id][track_id][prop];
                    }
                }
            }
            return false;
        },

        set_mydata: function (div_id, track_id, prop, value) {
            if (!this.mydata.hasOwnProperty(div_id)) {
                this.mydata[div_id] = {};
            }
            if (!this.mydata[div_id].hasOwnProperty(track_id)) {
                this.mydata[div_id][track_id] = {};
            }
            this.mydata[div_id][track_id][prop] = value;
        },

        process_data: function (data, options) {
            var o = typeof data === 'string' ?  JSON.parse(data) : data;
            this.set_mydata(options.div_id, options.track_id, 'timestamp', o.metadata.last_trkpt_time);
            this.set_mydata(options.div_id, options.track_id, 'altitude', o.metadata.last_trkpt_altitude);
            this.set_mydata(options.div_id, options.track_id, 'speed_ms', o.metadata.last_trkpt_speed_ms);
            this.set_mydata(options.div_id, options.track_id, 'speed_kmh', o.metadata.last_trkpt_speed_kmh);
            this.set_mydata(options.div_id, options.track_id, 'speed_mph', o.metadata.last_trkpt_speed_mph);
            return o.track;
        },

        get_sorted_keys: function( obj ) {
            var keys = [];
            for ( var key in obj ) {
                if ( obj.hasOwnProperty( key ) ) {
                    keys.push( key );
                }
            }
            keys.sort();
            return keys;
        },

        draw_tracks: function (map, featuregroup, mymapdata) {

            var div_id = mymapdata.div_id;
            var num_ready = 0;
            var track_id, start_icon, end_icon;
            var green_icon  = new this.Mapicon ({iconUrl: trackserver_settings['iconpath'] + 'greendot_15.png'});
            var yellow_icon = new this.Mapicon ({iconUrl: trackserver_settings['iconpath'] + 'yellowdot_15.png'});
            var red_icon    = new this.Mapicon ({iconUrl: trackserver_settings['iconpath'] + 'reddot_15.png'});

            if (mymapdata.tracks && mymapdata.tracks.length > 0 && mymapdata.tracks[0].track_url) {
                for (var i = 0; i < mymapdata.tracks.length; i++) {

                    track_id = mymapdata.tracks[i].track_id;

                    var _this = this;

                    // Values that are needed for drawing the track can be passed via layer_options.
                    // Remember that 'mymapdata' is also available within the layer's on(ready) handler.
                    var layer_options = {
                        track_id: track_id,
                        track_index: i,
                        old_track: this.get_mydata(div_id, track_id, 'track'),
                        old_markers: this.get_mydata(div_id, track_id, 'markers'),
                    }

                    if (mymapdata.style && !mymapdata.points) {
                        layer_options.style = mymapdata.style;
                    }

                    // Values that are needed in the process_data method can be passed via track_options
                    var track_options = {
                        ondata: L.bind( this.process_data, this ),
                        div_id: div_id,
                        track_id: track_id,
                    };

                    if (mymapdata.points) {

                        var geojsonMarkerOptions = {
                            radius: 5,
                            fillColor: "#ffcf00",
                            color: "#ffffff",
                            weight: 2,
                            opacity: 1,
                            fillOpacity: 0.8
                        };

                        if (mymapdata.style && mymapdata.style.color) {
                            geojsonMarkerOptions.fillColor = mymapdata.style.color;
                        }

                        track_options.geometry = 'points';
                        layer_options.pointToLayer = function(feature, latlng) {
                            return L.circleMarker(latlng, geojsonMarkerOptions);
                            //return L.marker(latlng, { icon: yellow_icon, zIndexOffset: -1000 });
                        }
                    }

                    var customLayer = L.geoJson(null, layer_options);
                    var track_function = omnivore.polyline;

                    if ( mymapdata.tracks[i].track_type == 'geojson' ) {
                        track_function = omnivore.geojson;
                    }

                    if ( mymapdata.tracks[i].track_type == 'gpx' ) {
                        track_function = omnivore.gpx;
                        track_options = { 'div_id': div_id };
                    }

                    if ( mymapdata.tracks[i].track_type == 'kml' ) {
                        track_function = omnivore.kml;
                        track_options = { 'div_id': div_id };
                    }

                    // First draw the new track...
                    var runLayer = track_function(mymapdata.tracks[i].track_url, track_options, customLayer )
                        .on ('ready', function (e) {

                            var track_id    = this.options.track_id;
                            var track_index = this.options.track_index;
                            var old_track   = this.options.old_track;
                            var old_markers = this.options.old_markers;

                            // ...and then delete the old one, to prevent flickering
                            if (old_track) {
                                featuregroup.removeLayer (old_track);
                            }

                            var layer_ids = _this.get_sorted_keys( this._layers );
                            var timestamp = _this.get_mydata(div_id, track_id, 'timestamp');
                            var altitude = _this.get_mydata(div_id, track_id, 'altitude');
                            var speed_ms = _this.get_mydata(div_id, track_id, 'speed_ms');
                            var speed_kmh = _this.get_mydata(div_id, track_id, 'speed_kmh');
                            var speed_mph = _this.get_mydata(div_id, track_id, 'speed_mph');
                            var id, layer, start_latlng, end_latlng, start_marker, end_marker, point_layer;
                            var markers = [];

                            for ( var i = 0; i < layer_ids.length; ++i ) {

                                id = layer_ids[i];
                                layer = this._layers[id];
                                if ('_latlngs' in layer) {
                                    start_latlng = layer._latlngs[0];
                                    end_latlng   = layer._latlngs[ layer._latlngs.length - 1 ];
                                }
                                else if (mymapdata.points && '_layers' in layer) {
                                    // Iterate over the _layers object, in which every layer, each containing a
                                    // point, has a numeric key. We need the first one and the last one.
                                    var j=0;
                                    for (var layerid in layer._layers) {
                                        if (layer._layers.hasOwnProperty(layerid)) {
                                            point_layer = layer._layers[layerid];
                                            if (j == 0) {
                                                start_latlng = point_layer._latlng;
                                                j++;
                                            }
                                        }
                                    }
                                    end_latlng = point_layer._latlng;
                                }
                                else {
                                    //  No tracks, no points? No markers.
                                    continue;
                                }

                                if (mymapdata.markers) {
                                    if (track_index == 0 || !mymapdata.continuous) {
                                        start_icon = green_icon;
                                        zIndexOffset = 2000;
                                    } else {
                                        start_icon = yellow_icon;
                                        zIndexOffset = 1000;
                                    }

                                    if (mymapdata.markers === true || mymapdata.markers == 'start') {
                                        start_marker = new L.marker(start_latlng, { icon: start_icon, zIndexOffset: zIndexOffset }).addTo(featuregroup);
                                        markers.push(start_marker);
                                    }
                                    if (mymapdata.markers === true || mymapdata.markers == 'end') {
                                        end_marker = new L.marker(end_latlng, { icon: red_icon, title: timestamp }).addTo(featuregroup);
                                        markers.push(end_marker);
                                    }
                                    _this.set_mydata(div_id, track_id, 'markers', markers);
                                }
                            }

                            // Remove any old markers
                            if (old_markers) {
                                for ( var i = 0; i < old_markers.length; ++i ) {
                                    featuregroup.removeLayer( old_markers[i] );
                                }
                            }

                            // Increment the 'ready' counter
                            num_ready++;

                            // 'ready' event target is layer, that has an options object that we created
                            if (e.target.options.track_id == 'live') {
                                // Then, center the map on the last point / current position
                                this._map.setView(end_latlng, this._map.getZoom());

                                if (mymapdata.infobar) {
                                    infobar_text = mymapdata.infobar_tpl;
                                    infobar_text = infobar_text.replace(/\{lat\}/gi, end_latlng.lat);
                                    infobar_text = infobar_text.replace(/\{lon\}/gi, end_latlng.lng);
                                    infobar_text = infobar_text.replace(/\{timestamp\}/gi, timestamp);
                                    infobar_text = infobar_text.replace(/\{altitude\}/gi, altitude);
                                    infobar_text = infobar_text.replace(/\{speedms\}/gi, speed_ms);
                                    infobar_text = infobar_text.replace(/\{speedkmh\}/gi, speed_kmh);
                                    infobar_text = infobar_text.replace(/\{speedmph\}/gi, speed_mph);
                                    mymapdata.infobar_div.innerHTML = infobar_text;
                                }
                            }
                            else {
                                if (!mymapdata.is_live && num_ready == mymapdata.tracks.length) {
                                    // or fit the entire collection of tracks on the map
                                    this._map.fitBounds(featuregroup.getBounds());
                                }
                            }

                        })
                        .on('error', function(err) {
                            var str = err.error.status + ' ' + err.error.statusText + ' - ' + err.error.responseText;
                            var popup = L.popup()
                                .setLatLng(center)
                                .setContent("Track could not be loaded:<br />" + str).openOn(this._map);
                        })
                        .addTo(featuregroup);

                    this.set_mydata(div_id, track_id, 'track', runLayer);
                }
            }
        },

        // Callback function to update the track.
        // Wrapper for 'draw_tracks' that gets its data from the liveupdate object.
        update_track: function (liveupdate) {

            var map          = liveupdate._map,
                featuregroup = liveupdate.options.featuregroup,
                mymapdata    = liveupdate.options.mymapdata;

            this.draw_tracks( map, featuregroup, mymapdata );
        },

        create_maps: function () {
            /*
                'div_id'       => $div_id,
                'track_url'    => $track_url,
                'default_lat'  => '51.44815',
                'default_lon'  => '5.47279',
                'default_zoom' => '12',
                'fullscreen'   => true,
            */

            var mapdata = this.mapdata;

            for (var i = 0; i < mapdata.length; i++) {

                var lat        = parseFloat (mapdata[i]['default_lat']);
                var lon        = parseFloat (mapdata[i]['default_lon']);
                var zoom       = parseInt (mapdata[i]['default_zoom']);
                var center     = L.latLng(lat, lon);

                var mymapdata  = mapdata[i];

                /*
                 * The map div in the admin screen is re-used when viewing multiple maps.
                 * When closing the thickbox, the map object is normally removed and the
                 * div freed of Leaflet bindings, but just in case something goes wrong
                 * there, we have a fallback here, that empties the div and sets ._leaflet
                 * to false, making re-initialization possible.
                 */
                var container = L.DomUtil.get( mymapdata.div_id );
                if (container._leaflet) {
                    jQuery(container).empty();
                    container._leaflet = false;
                }

                var map_layer0 = L.tileLayer(
                    trackserver_settings['tile_url'],
                    { attribution: trackserver_settings['attribution'], maxZoom: 18 });

                var options = {center : center, zoom : zoom, layers: [map_layer0], messagebox: true };
                var map = L.map( mymapdata.div_id, options );

                // An ugly shortcut to be able to destroy the map in WP admin
                if ( mymapdata.div_id == 'tsadminmap' ) {
                    this.adminmap = map;
                }

                if (mymapdata.fullscreen) {
                    L.control.fullscreen().addTo(map);
                }

                // Add a featuregroup to hold the track layers
                var featuregroup = L.featureGroup().addTo(map);

                // Load and display the tracks. Use the liveupdate control to do it when appropriate.
                if (mymapdata.is_live) {
                    var mapdivelement = L.DomUtil.get(mymapdata.div_id);
                    var infobar_container = L.DomUtil.create('div', 'trackserver-infobar-container', mapdivelement);
                    mymapdata.infobar_div = L.DomUtil.create('div', 'trackserver-infobar', infobar_container);
                    L.control.liveupdate ({
                        mymapdata: mymapdata,
                        featuregroup: featuregroup,
                        update_map: L.bind(this.update_track, this)
                    })
                    .addTo( map )
                    .startUpdating();
                }
                else {
                    this.draw_tracks ( map, featuregroup, mymapdata );
                }
            }
        }
    };

})();


// Requires global variable 'trackserver_mapdata' to be set
if (typeof trackserver_mapdata != 'undefined')
{
    Trackserver.init( trackserver_mapdata );
}
