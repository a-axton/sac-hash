define(['backbone','communicator','hbs!tmpl/nbhood-template','map','hbs!tmpl/infobox-template','hbs!tmpl/tweet','infobox'], function(Backbone, Communicator, nbhoodTemplate, map, infoboxTemp, tweetTemp){
	'use strict';

	return Backbone.Marionette.ItemView.extend({ 
		className: 'nbhood',

		template: {
			type: 'handlebars',
			template: nbhoodTemplate
		},

		events: {
			'click':'showTweets',
			'mouseenter':'over',
			'mouseleave':'out'
		},

		attributes: function(){
			return {
				'data-count': this.model.get('count'),
				// 'style': 'background-color:'+this.model.get('color')+';'
			}
		},

		onRender: function(){
			var self = this;

			this.createPolygon();
			this.infoBox();

			Communicator.events.on('clicked', function(){
				self.model.get('infobox').close();
			});
		},

		showTweets: function(){
			var hashtag = this.model.get('hashtag'),
				ib = this.model.get('infobox'),
				marker = this.model.get('marker'),
				center = this.model.get('center'),
				dom = this.$el,
				num = 10;

			Communicator.events.trigger('clicked');

			function timeSince(date) {

		    var seconds = Math.floor((new Date() - date) / 1000);

		    var interval = Math.floor(seconds / 31536000);

		    if (interval > 1) {
		        return interval + "y";
		    }
		    interval = Math.floor(seconds / 2592000);
		    if (interval > 1) {
		        return interval + "m";
		    }
		    interval = Math.floor(seconds / 86400);
		    if (interval > 1) {
		        return interval + "d";
		    }
		    interval = Math.floor(seconds / 3600);
		    if (interval > 1) {
		        return interval + "h";
		    }
		    interval = Math.floor(seconds / 60);
		    if (interval > 1) {
		        return interval + "m";
		    }
		    return Math.floor(seconds) + "s";
		}

			if ($(window).scrollTop() > 0){
				$('html, body').animate({'scrollTop':0}, 100, function(){
					map.panTo( center );
				});
			} else {
				map.panTo( center );

			}
			
			$('#block-view').animate({'width':'75%'}, 200).addClass('tweets-visible');

			$.ajax({
		  		type: 'GET',
		  		url: '/tweets/'+hashtag+'/'+num,
			}).done(function(data){
				$('.tweet-header h5').text('Showing tweets for #'+hashtag);
				$('.tweet-container').empty()
				for (var i = 0; i < data.statuses.length; i++){
					var status = data.statuses[i],
						tweet = linkify_entities(status),
	    				date = status.created_at;
	    				
				    status.entities.text = tweet;
				    date = new Date(date.replace(/^\w+ (\w+) (\d+) ([\d:]+) \+0000 (\d+)$/,"$1 $2 $4 $3 UTC"));
				    status.created_at = timeSince(date);

				    $('.tweet-container').append(tweetTemp(status));
				}

			});

			$('#tweet-feed').append($('.pace-activity'));
			ib.open(map, marker);
		},

		over: function(){
			this.$el.css('background-color', this.model.get('color'))
			this.$el.find('span').css({'box-shadow': '0px 0px 1px 0px rgba(0,0,0,.32)','background-color':'rgba(255,255,255,.06'})
		},

		out: function(){
			this.$el.css('background-color', 'white')
			this.$el.find('span').css({'box-shadow': '0px 0px 0px rgba(0,0,0,.2)','background-color': this.model.get('color')})
		},

		createPolygon: function(){
			var paths = this.model.get('geometry'),
				bounds = new google.maps.LatLngBounds(),
				center,
				coordinates = [],
				poly,
				color = this.model.get('color'),
				infoWindow,
				infoPosition,
				contentString;

				paths = paths.match('<coordinates>(.*?)</coordinates>');
				paths = paths[1].match(/(".*?"|[^"\s]+)+(?=\s*|\s*$)/g);

			for (var i = 0; i < paths.length; i++){
				var coords = paths[i].split(','),
					latLng = new google.maps.LatLng(coords[1],coords[0]);

				coordinates.push( latLng )
				bounds.extend( latLng )
			}

			center = this.GetCentroid(coordinates);
			infoPosition = new google.maps.LatLng(center.lb, center.mb);
			
			poly = new google.maps.Polygon({
			    paths: coordinates,
			    strokeColor: '#000000',
			    strokeOpacity: 0.2,
			    strokeWeight: 1,
			    fillColor: color,
			    fillOpacity: 0.8
			});

			poly.setMap(map)

			this.model.set('center', center);
			this.model.set('poly', poly);
		},

		infoBox: function(){

			var poly = this.model.get('poly'),
				center = this.model.get('center'),
				nbhood = this.model.get('NAME2'),
				hashtag = this.model.get('hashtag'),
				count = this.model.get('count'),
				self = this,
				marker,
				boxText,
				boxOptions,
				ib;

			marker = new google.maps.Marker({
		        map: map,
		        position: center,
		        visible: false
        	});
                
        	boxOptions = {
                 content: infoboxTemp(this.model.attributes)
                ,disableAutoPan: false
                ,maxWidth: 0
                ,pixelOffset: new google.maps.Size(10, -60)
                ,zIndex: null
                // ,closeBoxMargin: "10px 2px 2px 10px"
                ,closeBoxURL: "http://www.google.com/intl/en_us/mapfiles/close.gif"
                ,infoBoxClearance: new google.maps.Size(0, 0)
                ,isHidden: false
                ,pane: "floatPane"
                ,enableEventPropagation: false
        	};
		
			ib = new InfoBox(boxOptions);
	        
	        google.maps.event.addListener(poly, 'click', function() {
				Communicator.events.trigger('clicked');
	    		ib.open(map, marker);
	    		self.showTweets();
	  		}); 

	  		this.model.set('infobox', ib);
	  		this.model.set('marker', marker)
		},

		GetCentroid: function(paths){
		    var f;
		    var x = 0;
		    var y = 0;
		    var nPts = paths.length;
		    var j = nPts-1;
		    var area = 0;
		    
		    for (var i = 0; i < nPts; j=i++) {   
		        var pt1 = paths[i];
		        var pt2 = paths[j];
		        f = pt1.lat() * pt2.lng() - pt2.lat() * pt1.lng();
		        x += (pt1.lat() + pt2.lat()) * f;
		        y += (pt1.lng() + pt2.lng()) * f;
		        
		        area += pt1.lat() * pt2.lng();
		        area -= pt1.lng() * pt2.lat();        
		    }
		    area /= 2;
		    f = area * 6;
		    return new google.maps.LatLng(x/f, y/f);
		}
	});
});