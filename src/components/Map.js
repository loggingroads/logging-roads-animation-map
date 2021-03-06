var React = require('react');

var mapboxgl = require("mapbox-gl");
var baseMapStyles = require('./mapStyles');
var styles = require('./styles');

var years = require('./years');
var scenes = require('./scenes');

module.exports = React.createClass({
  contextTypes: {
    router: React.PropTypes.func
  },


  propTypes:  {
    data: React.PropTypes.object
  },

  getInitialState() {
    return {
      currentYearIndex: -1,
      currentSceneIndex: 0,
      useScenes: !this.props.disableScenes,
      firstLoad: true,
      waitForStyleChange: false,
      ignoreMoveCount: 0,
      styleWaitCallback(){},
      playing: false
    }
  },

  getDefaultProps() {
    return {
      hideUI: false,
      disableScroll: false,
      hideLogo: false,
      disableInteraction: false,
      disableScenes: false,
      showLngLat: false,
      disableButtons: false,
      showResume: false
    }
  },



  componentDidMount() {
    var _this = this;
    mapboxgl.accessToken = 'pk.eyJ1IjoiY3Jvd2Rjb3ZlciIsImEiOiI3akYtNERRIn0.uwBAdtR6Zk60Bp3vTKj-kg';

    var map = new mapboxgl.Map({
      container: 'map',
      //style: mapStyles.dark, //stylesheet location
      style: baseMapStyles.satelliteHybrid,
      zoom: 7.5,
      center: [22.0715, 2.6769],
      interactive: !this.props.disableInteraction,
      dragRotate: false,
      touchZoomRotate: false
    });
    if(this.props.disableScroll){
      map.scrollZoom.disable();
    }

    map.on('moveend', function () {
      if(_this.state.ignoreMoveCount > 0){
        _this.setState({ignoreMoveCount: _this.state.ignoreMoveCount-1});
      }else{
          var useScenes = _this.state.useScenes;
          if(useScenes){
            useScenes = false;
          }
          _this.setState({lngLat: map.getCenter(), zoom: map.getZoom(), useScenes});
      }

    });


    map.on('style.load', function() {

      styles.getSources().forEach(function(source){
         map.addSource(source.name, source.config);
      });

      styles.getUnknown().forEach(function(layer){
        map.addLayer(layer);
      })

      years.forEach(function(year){
      var layers = styles.getYear(year.id);
    
      layers.forEach(function(layer){
         map.addLayer(layer);
      });
    });

      if(_this.state.firstLoad){

        _this.setState({firstLoad: false});

        _this.play();
      } else {
        _this.state.styleWaitCallback();
      }



    });

    if(!this.props.hideUI){
      map.addControl(new mapboxgl.NavigationControl(), 'top-left');
    }


  this.map = map;

  },


  tick(restart){
    var _this = this;
    if(this.state.playing || restart){
      //increase counters
      var currentYearIndex = this.state.currentYearIndex;
      var currentSceneIndex = this.state.currentSceneIndex;
      var waitForStyleChange = false;
      var scene = null, prevScene = null;

      if(currentYearIndex == (years.length)-1){
        //reset to the beginning
        currentYearIndex = 0;
        this.clearYearLayers();

        if(this.state.useScenes){
          //find previous scene
          if(currentSceneIndex == 0){
            prevScene = scenes[scenes.length -1];
          }else{
            prevScene = scenes[currentSceneIndex];
          }

          if(currentSceneIndex == scenes.length-1){
            currentSceneIndex=0;
          }else{
            currentSceneIndex++;
          }
          scene = scenes[currentSceneIndex];
          this.setState({ignoreMoveCount: 1});
          if(prevScene.style.name != scene.style.name){
            //we need to change the style and wait for it to complete
            this.map.setStyle(scene.style);
            waitForStyleChange = true;
          }else{
            //we can just fly to the next scene
            _this.map.flyTo({
              center: scene.center,
              zoom: scene.zoom
            });

          }

        }

      }else{
        currentYearIndex++;
      }

      //now update the display
      var currYear = years[currentYearIndex];

      if(waitForStyleChange){

        var waitCallback = function(){
          setTimeout(function(){

            _this.map.flyTo({
              center: scene.center,
              zoom: scene.zoom,
              pitch: scene.pitch
            });

            styles.getYear(currYear.id).forEach(function(layer){
               _this.map.setLayoutProperty(layer.id, 'visibility', 'visible');
            });
          
            //tick again
            setTimeout(function(){ _this.tick() }, 1000);
          }, 2000);


        };
        this.setState({currentYearIndex, currentSceneIndex,
          waitForStyleChange, styleWaitCallback: waitCallback});
      }else{
        styles.getYear(currYear.id).forEach(function(layer){
            _this.map.setLayoutProperty(layer.id, 'visibility', 'visible');
        });
        this.setState({currentYearIndex, currentSceneIndex, waitForStyleChange});
        //tick again
        setTimeout(function(){ _this.tick() }, 1000);
      }


    }
  },

  pause(){
    this.setState({playing: false});
  },

  play(){
    this.setState({playing: true});
    this.tick(true);
  },

  resumeDemo(e){
    e.preventDefault();
    this.setState({useScenes: true});
  },

  clearYearLayers(){
    var _this = this;
    years.forEach(function(year){
      var layers = styles.getYear(year.id);
      
      layers.forEach(function(layer){
         _this.map.setLayoutProperty(layer.id, 'visibility', 'none');
      });
    });
  },

  componentWillUnmount() {
    this.map.remove();
  },

  render() {
    var logo = '';
    if(!this.props.hideLogo){
      logo = (
        <a href="http://loggingroads.org"><b className="logo">LOGGING ROADS</b></a>
      );
    }

    var year = '';
    if(years[this.state.currentYearIndex]){
      year = (<h1 className="year">{years[this.state.currentYearIndex].label}</h1>);
    }

    var lngLat ='';
    if(this.props.showLngLat && this.state.lngLat){
      lngLat = (<p className="lng-lat">Lng: {this.state.lngLat.lng}, Lat:{this.state.lngLat.lat}, Zoom:{this.state.zoom} </p>)
    }

    var playPause = '';
    if(!this.props.disableButtons){
      if(this.state.playing){
        playPause = (<a className="playPauseButton waves-effect waves-orange btn-floating btn-large" onClick={this.pause}><i className="material-icons">pause</i></a>);
      } else {
         playPause = (<a className="playPauseButton waves-effect waves-orange btn-floating btn-large" onClick={this.play}><i className="material-icons">play_arrow</i></a>);
      }
    }

    var resumeDemo = '';
    if(!this.props.disableButtons && this.props.showResume && !this.props.disableScenes && !this.state.useScenes){
      resumeDemo = (<a className="resumeButton waves-effect waves-orange btn orange darken-3" onClick={this.resumeDemo}>Resume Demo</a>);
    }

    return <div id="map" className="map" style={{width: '100%', height: '100%'}}>
      {logo}
      {year}
      {lngLat}
      {playPause}
      {resumeDemo}
    </div>;
  }
});
