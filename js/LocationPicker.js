(function () {
    function LocationPickerConstructor() {
        const pinIcon = '/img/pin.svg';
        const pinIconSelected = '/img/pin-selected.svg';
        const days = [
            'monday',
            'tuesday',
            'wednesday',
            'thursday',
            'friday',
            'saturday',
            'sunday'
        ];

        const searchKeys = [
            'id',
            'zip',
            'name',
            'address',
            'city'
        ];

        let lang = null;

        let map = null;
        let latLongBounds = null;
        let selectedMarker = null;
        let selectedLocation = null;
        let infoWindow = null;
        let markers = {};
        let dropOffs = {};
        let renderedLocations = [];

        let locations = {};

        // Register public method and properties.
        this.init = init;

        /**
         * Initializes location picker.map.event.trigger('resize');
         *
         * @param googleMap
         */
        function init(googleMap) {
            map = googleMap;
            lang = getParameterByName('lang');
            lang = lang ? lang : 'en';

            attachGlobalEventListeners();
            initializeSearchBox();

            window.top.postMessage({type: 'ready'}, '*');
        }

        /**
         * Attaches event listeners on map div.
         */
        function attachGlobalEventListeners() {
            window.addEventListener('resize', resizeMap, true);
            window.addEventListener('message', postMessageHandler);
        }

        /**
         * Message receiver.
         *
         * @param event
         */
        function postMessageHandler(event) {
            if (event.data.type === 'locations') {
                renderedLocations = [];
                for (let loc of event.data.payload) {
                    locations[loc.id] = loc;
                    renderedLocations.push(loc.id);
                }

                addPins(true);
                addLocations();

                document.getElementById('spinner').classList.add('disabled');
            }

            if (event.data.type === 'reset') {
                window.location.reload(true);
            }
        }

        /**
         * Initializes search-box.
         */
        function initializeSearchBox() {
            let searchBox = document.getElementById('search-box');

            if (searchBox) {
                searchBox.addEventListener('keyup', debounce(200, searchBoxKeyupHandler));

                let searchLabel = document.getElementById('search-box-label');
                searchLabel.innerHTML = getTranslation(lang, ['searchLabel']);
            }
        }

        /**
         * Handles keyup on search-box.
         *
         * @param event
         */
        function searchBoxKeyupHandler(event) {
            let value = event.target.value;

            renderedLocations = Object.keys(locations);

            if (value !== '') {
                renderedLocations = [];

                for (let term of searchKeys) {
                    let result = filterByKey(locations, term, value);
                    renderedLocations.push(...result);
                }

                renderedLocations = renderedLocations.filter(function (value, index, array) {
                    return array.indexOf(value) === index;
                })
            }

            addPins();
            addLocations();
        }

        /**
         * Adds pins to the map.
         *
         * @param {boolean} [resize]
         */
        function addPins(resize) {
            for (let displayed in markers) {
                if (markers.hasOwnProperty(displayed)) {
                    markers[displayed].setMap(null);
                }
            }

            if (resize) {
                latLongBounds = new google.maps.LatLngBounds();
            }

            markers = {};
            selectedMarker = null;

            for (let id of renderedLocations) {
                let location = locations[id];
                let latLong = new google.maps.LatLng(location.lat, location.long);
                markers[id] = createMarker(latLong, location);

                if (resize) {
                    latLongBounds.extend(latLong);
                }
            }

            map.fitBounds(latLongBounds);
        }

        /**
         * Adds Locations.
         */
        function addLocations() {
            let locationsNode = document.getElementById('locations');

            while (locationsNode.firstChild) {
                locationsNode.firstChild.remove();
            }

            for (let displayed in dropOffs) {
                if (dropOffs.hasOwnProperty(displayed)) {
                    dropOffs[displayed].remove();
                }
            }

            dropOffs = {};
            selectedLocation = null;

            for (let id of renderedLocations) {
                let location = locations[id];
                let locationElement = createLocation(location);
                dropOffs[id] = locationElement;
                locationsNode.appendChild(locationElement);
            }
        }

        /**
         * Creates new marker with attached event handler.
         *
         * @param {google.maps.LatLng}latLong
         * @param {object} data
         *
         * @return {google.maps.Marker}
         */
        function createMarker(latLong, data) {
            let marker = new google.maps.Marker({
                position: latLong,
                map: map,
                visible: true,
                icon: pinIcon
            });

            marker.additionalOptions = {
                selected: false,
                workingHours: false,
                data: data
            };

            google.maps.event.addListener(marker, 'click', function () {
                markerClickedHandler(marker);
            });

            return marker;
        }

        /**
         * Creates DropOff location.
         *
         * @param location
         * @return {Node}
         */
        function createLocation(location) {
            let template = getTemplate('location-template');

            getElement(template, 'location-name').innerHTML = location.name;
            getElement(template, 'location-street').innerHTML = location.address;
            getElement(template, 'location-city').innerHTML = location.city + ', ' + location.zip;

            template.setAttribute('data-id', location.id);

            template.addEventListener('click', locationClickedHandler);

            return template;
        }

        /**
         * Marker clicked event handler.
         *
         * @note function is intended to be used in closure.
         *
         * @param {google.maps.Marker} marker
         */
        function markerClickedHandler(marker) {
            if (marker === selectedMarker) {
                return;
            }

            unselectSelectedMarkers();

            marker.setIcon(pinIconSelected);
            marker.additionalOptions.selected = true;
            selectedMarker = marker;

            locationClickedHandler({target: dropOffs[marker.additionalOptions.data.id]});
            openInfoWindow(marker);
        }

        /**
         * Handles click event on location.
         */
        function locationClickedHandler(event) {
            if (event.target === selectedLocation) {
                return;
            }

            unselectSelectedLocation();

            let id = event.target.getAttribute('data-id');

            selectedLocation = dropOffs[id];
            selectedLocation.classList.add('selected');

            google.maps.event.trigger(markers[id], 'click')
        }

        /**
         * Unselects selected markers.
         */
        function unselectSelectedMarkers() {
            if (selectedMarker) {
                selectedMarker.setIcon(pinIcon);
                selectedMarker = null;
                resizeMap();
            }
        }

        /**
         * Unselects location.
         */
        function unselectSelectedLocation() {
            if (selectedLocation) {
                selectedLocation.classList.remove('selected');
                selectedLocation = null;
            }
        }

        /**
         * Opens info popup above marker.
         *
         * @param marker
         */
        function openInfoWindow(marker) {
            if (infoWindow) {
                infoWindow.close();
            }

            infoWindow = new google.maps.InfoWindow({
                content: getInfoWindowContent(marker.additionalOptions.data)
            });

            google.maps.event.addListener(infoWindow, 'closeclick', function () {
                unselectSelectedMarkers();
                unselectSelectedLocation();
            });

            infoWindow.open(map, marker);
        }

        /**
         * Returns info window content.
         *
         * @param {object} data
         *
         * @return {Node}
         */
        function getInfoWindowContent(data) {
            let template = getTemplate('info-window-template');

            let title = getElement(template, 'title');
            title.innerHTML = data.name;

            let id = getElement(template, 'id');
            id.innerHTML = getTranslation(lang, ['id']) + ': ' + data.id;

            let address = getElement(template, 'address');
            address.innerHTML = data.address;

            let selectButton = getElement(template, 'select-button');
            selectButton.addEventListener('click', selectButtonClickHandler);
            selectButton.innerHTML = getTranslation(lang, ['selectLabel']);

            let workingHoursButton = getElement(template, 'working-hours-button');
            workingHoursButton.addEventListener('click', function () {
                workingHoursButtonClickHandler(template);
            });
            workingHoursButton.innerHTML = getTranslation(lang, ['workingHoursLabel']);

            let workingHoursPoint = getElement(template, 'working-hours');

            for (let day of days) {
                if (data.workingHours[day]) {
                    workingHoursPoint.appendChild(getWorkingHoursTemplate(day, data.workingHours[day]));
                }
            }

            return template;
        }

        /**
         * Retrieves working hours template.
         *
         * @param {string} day
         * @param {string} hours
         * @return {Node}
         */
        function getWorkingHoursTemplate(day, hours) {
            let element = getTemplate('working-hours-template');

            let dayElement = getElement(element, 'day');
            dayElement.innerHTML = getTranslation(lang, ['days', day]);

            let hourElement = getElement(element, 'hours');
            hourElement.innerHTML = hours;

            return element;
        }

        /**
         * Handles click event on select button in info window.
         */
        function selectButtonClickHandler() {
            let id = selectedMarker.additionalOptions.data.id;
            window.top.postMessage({type: 'select', payload: {id: id}}, '*');
        }

        /**
         * Handles working hours button clicked event.
         *
         * @param template
         */
        function workingHoursButtonClickHandler(template) {
            let workingHoursSection = getElement(template, 'working-hours');
            if (selectedMarker.additionalOptions.workingHours) {
                workingHoursSection.classList.remove('enabled');
            } else {
                workingHoursSection.classList.add('enabled');
            }

            selectedMarker.additionalOptions.workingHours = !selectedMarker.additionalOptions.workingHours;
            google.maps.event.trigger(map, 'resize');
        }

        /**
         * Returns template element
         *
         * @param {string} template
         * @return {Node}
         */
        function getTemplate(template) {
            return document.getElementById(template).cloneNode(true);
        }

        /**
         * Retrieves element in template.
         *
         * @param {Node} node
         * @param {string} element
         * @return {Element}
         */
        function getElement(node, element) {
            return node.querySelector(`#${element}`);
        }

        /**
         * Triggers resize event on map.
         */
        function resizeMap() {
            if (selectedMarker) {
                map.setCenter(selectedMarker.getPosition());
            } else if (latLongBounds) {
                map.fitBounds(latLongBounds);
            }
            google.maps.event.trigger(map, 'resize');
        }

        /**
         * Retrieves translation.
         *
         * @param {string} lang
         * @param {array} keys
         * @return {string}
         */
        function getTranslation(lang, keys) {
            let object = LocationPickerTranslations;

            object = object.hasOwnProperty(lang) ? object[lang] : object['en'];

            for (let key of keys) {
                object = object[key];

                if (typeof object === 'undefined') {
                    return keys.join('.');
                }
            }

            return object;
        }

        /**
         * Filters hash-map by value.
         *
         * @param {object} collection
         * @param {string} key
         * @param {string} value
         */
        function filterByKey(collection, key, value) {
            let result = [];

            value = value.toUpperCase();

            for (let id in collection) {
                if (collection.hasOwnProperty(id)) {
                    let target = collection[id][key].toUpperCase();
                    if (target.match(new RegExp('.*' + value + '.*')) !== null) {
                        result.push(id);
                    }
                }
            }

            return result;
        }

        /**
         * Debounces function.
         *
         * @param {number} delay
         * @param {function} target
         * @return {Function}
         */
        function debounce(delay, target) {
            let timerId;
            return function (...args) {
                if (timerId) {
                    clearTimeout(timerId);
                }

                timerId = setTimeout(function () {
                    target(...args);
                    timerId = null;
                }, delay);
            }
        }

        /**
         * Retrieves query parameter from url.
         *
         * @param {string} name
         * @param {[string]} url
         *
         * @return {string | null}
         */
        function getParameterByName(name, url) {
            if (typeof url === 'undefined') {
                url = window.location.href;
            }

            name = name.replace(/[\[\]]/g, '\\$&');

            let regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)');
            let results = regex.exec(url);

            if (!results) return null;

            if (!results[2]) return '';

            return decodeURIComponent(results[2].replace(/\+/g, ' '));
        }

    }

    window.locationPicker = new LocationPickerConstructor();
})();