/**
 * This is a complete example of a mobile application using the Backpage API.
 * This app could be wrapped in something like PhoneGap to create a native
 * mobile application.
 */
$(window).on('ready', function() {
  /**
   * If search results are loading.  Used to throttle infinite scroll loading 
   * of results.
   * @type {Boolean}
   */
  var isLoading = false;

  /**
   * The number of pending AJAX requests.  Used to determine if the loading
   * gif should be displayed.
   * @type {Number}
   */
  var requestsPending = 0;

  /**
   * The current page of search results.
   * @type {Number}
   */
  var curPage = 0;

  /**
   * If we've hit the last page of results, prevents further queries.
   * @type {Boolean}
   */
  var lastPage = false;

  /**
   * Current latitude/longitude position, only detected/set if no site has
   * been selected before.
   * @type {Object}
   */
  var curPos = null;

  /**
   * Current active request to load ads.  Aborted if a new category or site
   * is selected.
   * @type {Object}
   */
  var activeRequest = null;

  /**
   * Splits the current URL hash into key/value pairs.
   * @return {Object} Key/value pairs representing the URL hash.
   */
  var curOpts = function() {
    var hash = window.location.hash;
    var components = hash.split('?');
    var keys = components[1];
    if (!keys) {
      return {};
    }
    var pairs = keys.split("&").reduce(function(prev, curr, i, arr) {
      var p = curr.split("=");
      prev[decodeURIComponent(p[0])] = decodeURIComponent(p[1]);
      return prev;
    }, {});
    return pairs;
  };

  /**
   * Builds a URL hash string out of the key/value pairs in opts.
   * @param  {Object} opts Key/value pairs to turn into a hash.
   * @return {String}      A hash string representing opts.
   */
  var buildHash = function(opts) {
    var hash = '#?';
    var first = true;
    for (var key in opts) {
      if (opts[key] === '') {
        continue;
      }
      if (!first) {
        hash += "&";
      }
      first = false;
      hash += key + '=' + opts[key];
    }
    return hash;
  };

  /**
   * Renders the page based on the current URL hash.
   */
  var renderHash = function() {
    var opts = curOpts();
    // if a site has been chosen
    if (opts.site) {
      // populate site input
      $('#site-input').val(opts.site);
      // set terms of service link
      var tosUrl = 'http://' + opts.site + '/online/TermsOfUse';
      $('.tos-link').off('click');
      $('.tos-link').on('click', function(e) {
        e.preventDefault();
        window.open(tosUrl, '_blank', 'location=yes');
      });
      // load section/category list for current site
      requestsPending++;
      loadCategories(opts.site)
      .then(function(sections, categories) {
        requestsPending--;
        // render and show category selector if this is a new search
        if (curPage === 0) {
          renderCategories(opts.site, sections, categories);
          $('#categories-toggle-container').show();
        }
        // if a category is selected
        if (opts.category) {
          // populate category header with category name
          $('#category-header').text(opts.category);
          var sectionId;
          var searchFields;
          // find category and section ids for selected category
          $.each(categories, function(key, category) {
            if (category.Name == opts.category) {
              opts.category = category.Id;
              sectionId = category.Section;
            }
          });
          $.each(sections, function(key, section) {
            // store valid search fields for selected category
            if (section.Id == sectionId) {
              searchFields = section.SearchFields;
            }
            // if "all" category selected then search by section instead
            // of category
            if ("all " + section.Name == opts.category) {
              delete opts.category;
              opts.section = section.Id;
              searchFields = section.SearchFields;
            }
          });
          requestsPending++;
          // if this is the first page then remove any ads already on the page
          // infinite scroll calls renderHash() to load more images so don't
          // remove if curPage != 0
          if (curPage === 0) {
            removeAds();
          }
          opts.page = curPage;
          // populates/modifies opts based on search filters
          setupSearch(searchFields, opts);
          // request ads
          loadAds(opts)
          .then(function(ads) {
            // no more results left
            if (ads.length === 0) {
              lastPage = true;
            }
            requestsPending--;
            renderAds({
              ads: ads,
              site: opts.site,
              categories: categories
            });
          })
          .fail(function(xhr, err) {
            requestsPending--;
            alert('There was a problem connecting to the Backpage servers, please try again.');
          });
          // show search filter
          $('#search-toggle-container').show();
        // no category selected
        } else {
          removeAds();
          // hide search filter
          $('#search-toggle-container').hide();
          // open category selector
          $('#categories-toggle-content').collapse('show');
        }
      })
      .fail(function(xhr, err) {
        requestsPending--;
        alert('There was a problem connecting to the Backpage servers, please try again.');
      });
    }
  };

  /**
   * Resets ad paging variables for new search results.
   */
  var resetAdPaging = function() {
    curPage = 0;
    lastPage = true;
  };

  /**
   * Loads sections and categories for a given site.
   * @param  {String} site The site to load from.
   * @return {Object}      Deferred object.
   */
  var loadCategories = function(site) {
    var params = {};
    try {
      if (device.platform == 'iOS') {
        params.os = 'ios';
      }
    } catch (e) {
    }
    return $.when(
      $.fn.backpage({
        site: site,
        object: 'Section',
        params: params
      }),
      $.fn.backpage({
        site: site,
        object: 'Category',
        params: params
      })
    );
  };

  /**
   * Renders the category selector.
   * @param  {String} site       The site to load from.
   * @param  {Array}  sections   Array of section objects.
   * @param  {Array}  categories Array of categories objects.
   */
  var renderCategories = function(site, sections, categories) {
    // setup handlebars templates
    var sectionSrc = $('#section-template').html();
    var sectionTemplate = Handlebars.compile(sectionSrc);
    var categorySrc = $('#category-template').html();
    var categoryTemplate = Handlebars.compile(categorySrc);

    // remove existing category list
    var container = $('#categories-container');
    container.html('');

    $.each(sections, function() {
      var categoryHTML = '';
      var section = this;
      // render the "all" category for this section
      categoryHTML += categoryTemplate({
        name: 'all ' + this.Name,
        disclaimer: section.Disclaimer
      });
      $.each(categories, function() {
        // make sure this category belongs to the current section
        if (this.Section != section.Id) {
          return;
        }
        // render the category
        categoryHTML += categoryTemplate({
          name: this.Name,
          disclaimer: section.Disclaimer
        });
      });
      // render the section
      container.append(sectionTemplate({
        id: this.Id,
        name: this.Name,
        categoryHTML: categoryHTML
      }));
    });

    // add click action to category buttons
    container.find('.category-button').each(function() {
      var category = $(this);
      $(this).on('click', function(e) {
        e.preventDefault();
        var opts = {
          site: curOpts().site,
          category: encodeURIComponent($(this).text())
        };
        // if section has a disclaimer show it
        var disclaimer = category.attr('data-disclaimer');
        if (disclaimer) {
          $('.disclaimer-body').text(disclaimer);
          $('#disclaimer').modal('show');
          $('.agree-btn').off('click');
          $('.agree-btn').on('click', function() {
            resetAdPaging();
            selectCategory(opts);
          });
        // no disclaimer
        } else {
          resetAdPaging();
          selectCategory(opts);
        }
      });
    });
  };

  /**
   * Closes the category selector and sets the new hash based on opts.
   * @param  {[type]} opts Key/value pairs representing the URL hash.
   */
  var selectCategory = function(opts) {
    $('#categories-toggle-content').collapse('hide');
    window.location.hash = buildHash(opts);
  };

  /**
   * Makes a search request for Ads.
   * @param  {Object} opts Search parameters, see API documentation.
   * @return {Object}      Deferred object.
   */
  var loadAds = function(opts) {
    var params = {
      Category: opts.category,
      Section: opts.section,
      // 25 per page
      Max: 25,
      StartIndex: opts.page * 25 || 0
    };
    if (opts.keywords) {
      params.Keyword = opts.keywords;
    }
    if (opts.pricemin) {
      params.PriceMin = opts.pricemin;
    }
    if (opts.pricemax) {
      params.PriceMax = opts.pricemax;
    }
    if (opts.pets) {
      params.PetsAccepted = opts.pets;
    }
    if (opts.bedrooms) {
      params.Bedrooms = opts.bedrooms;
    }

    return $.fn.backpage({
      site: opts.site,
      object: 'Search',
      params: params
    });
  };

  /**
   * Removes all search results from the current page.
   */
  var removeAds = function() {
    $('#ads').masonry('remove', $('.ad-thumb'));
    $('.ad-thumb').remove();
  };

  /**
   * Renders search results.
   * @param  {Object} opts Valid keys are ads, categories, and site.
   */
  var renderAds = function(opts) {
    var ads = opts.ads || [];
    console.log(ads);
    // compile handlebars templates
    var adThumbSrc = $('#ad-thumb-template').html();
    var adThumbTemplate = Handlebars.compile(adThumbSrc);
    var adThumbNoImageSrc = $('#ad-thumb-no-image-template').html();
    var adThumbNoImageTemplate = Handlebars.compile(adThumbNoImageSrc);

    var container = $('#ads');
    $.each(ads, function() {
      var html;
      // if the ad has images
      if (this.Image) {
        html = $(adThumbTemplate({
          id: this.Id,
          image: this.Image,
          title: this.Title,
          region: this.Region
        }));
      // ad has no images
      } else {
        html = $(adThumbNoImageTemplate({
          id: this.Id,
          title: this.Title,
          region: this.Region
        }));
      }
      // setup click handler for each result
      html.find('a').on('click', function(e) {
        e.preventDefault();
        // load ad details
        requestsPending++;
        loadAd({
          id: $(this).data('id'),
          site: opts.site
        })
        .then(function(ads) {
          // render ad details
          requestsPending--;
          renderAd(ads[0], opts.categories, opts.site);
        })
        .fail(function(xhr, err) {
          alert('There was a problem connecting to the Backpage servers, please try again.');
        });
      });
      // append ads to container and notify masonry
      container.append(html).masonry('appended', html);
      container.masonry('reload');
    });

    // when all images have loaded
    container.imagesLoaded(function() {
      // tell masonry to refresh
      container.masonry('reload');
      // allow further infinite scrolling
      isLoading = false;
    });
  };

  /**
   * Get details of one ad.
   * @param  {Object} opts Search options, id is only valid option.
   * @return {Object}      Deferred.
   */
  var loadAd = function(opts) {
    return $.fn.backpage({
      object: 'Ad',
      site: opts.site,
      params: {
        Id: opts.id
      }
    });
  };

  /**
   * Renders the ad modal.
   * @param  {Object} ad         Ad to render.
   * @param  {Array}  categories Array of categories.
   * @param  {String} site       Site the ad came from (losangeles.backpage.com).
   */
  var renderAd = function(ad, categories, site) {
    console.log(ad);
    // scroll to top of ad modal body
    $('.ad-body').scrollTop(0);
    $('.ad-title').text(ad.Title);
    // rewrite links to open in new window
    var content;
    try {
      content = $('<div>' + ad.Ad + '</div>');
      content.find('a').each(function() {
        var url = $(this).attr('href');
        $(this).on('click', function(e) {
          e.preventDefault();
          window.open(url, '_blank', 'location=yes');
        });
      });
    // failed to parse html
    } catch (e) {
      content = ad.Ad;
      content = content.replace(/<a(\s[^>]*)?>(.*?)<\/a>/ig, '$2');
    }
    $('.ad-text').html(content);
    $('.ad-posted-at').text(moment(ad.PostingTime).fromNow());
    $('.ad-region').text(ad.Region);
    $('.full-ad-link').off('click');
    $('.full-ad-link').on('click', function(e) {
      e.preventDefault();
      window.open(ad.AdUrl, '_blank', 'location=yes');
    });
    // show map link
    if (ad.MapAddress && ad.MapZip && ad.MapAddress != 'null' && ad.MapZip != 'null') {
      var mapUrl = "http://maps.google.com/maps?q=" + encodeURIComponent(ad.MapAddress + " " + ad.MapZip);
      $('.map-link').off('click');
      $('.map-link').on('click', function(e) {
        e.preventDefault();
        window.open(mapUrl, '_blank', 'location=yes');
      });
      $('.map-link').show();
    } else {
      $('.map-link').hide();
    }
    // hide reply link by default
    $('.reply-link').hide();
    if (ad.AllowReplies != 'No') {
      $('.reply-link').off('click');
      $('.reply-link').on('click', function(e) {
        e.preventDefault();
        window.open(ad.ReplyUrl, '_blank', 'location=yes');
      });
      $('.reply-link').show();
    }
    // show poster's age
    if (ad.Age) {
      $('.ad-age').text('Age: ' + ad.Age);
      $('.ad-age').show();
    } else {
      $('.ad-age').hide();
    }
    // show number of bedrooms
    if (ad.Bedrooms) {
      $('.ad-bedrooms').show();
      $('.ad-bedrooms').text('Bedrooms: ' + ad.Bedrooms);
    } else {
      $('.ad-bedrooms').hide();
    }
    // show price
    if (ad.Price) {
      $('.ad-price').show();
      $('.ad-price').text('$' + ad.Price);
    } else {
      $('.ad-price').hide();
    }
    // clear image carousel
    $('.carousel-items').html('');
    // if the ad has images
    if (ad.Image) {
      // if the ad only has one image it won't be an array, put it in one
      if (!(ad.Image instanceof Array)) {
        ad.Image = [ad.Image];
        $('.carousel-control').hide();
      } else {
        $('.carousel-control').show();
      }
      var first = true;
      $.each(ad.Image, function(idx, imgUrl) {
        var item = $('<div class="item"></div>');
        // make the first image 'active'
        if (first) {
          item.addClass("active");
          first = false;
        }
        // use the large image instead of medium that API returns
        imgUrl = imgUrl.replace('/u/medium/', '/u/large/');
        item.append('<img src="' + imgUrl + '"/>');
        $('.carousel-items').append(item);
      });
      // remove any previous data
      $('#view-ad-carousel').removeData('carousel');
      // initialize the carousel
      $('#view-ad-carousel').carousel({
        interval: false
      });
      // show the carousel
      $('#view-ad-carousel').show();
    // ad has no images
    } else {
      $('#view-ad-carousel').hide();
    }

    // pop up the ad modal
    $('#view-ad').modal('show');
  };

  /**
   * Called when the window is resized or the ad modal's 'show' event 
   * is fired.  Adjusts the width of the modal to better fit the screen.
   */
  var resizeModalShow = function() {
    // padding changes at 480px
    if ($(window).width() < 480) {
      $('#view-ad').width($(window).width() - 20);
    } else {
      $('#view-ad').width($(window).width() - 40);
    }
    // body is padded 20px on either side when width is >= 768
    if ($(window).width() >= 768) {
      $('#view-ad').css('margin-left', -(($(window).width() - 40) / 2));
    } else {
      $('#view-ad').css('margin-left', 0);
    }
    // push down to current scroll location
    // ios only
    // $('#view-ad').css('top', $('body').scrollTop() + 20);
    $('#view-ad').css('top', 15);
  };

  /**
   * Called when the window is resized or the ad modal's 'shown' event 
   * is fired.  Adjust the height of the modal to better fit the screen.
   */
  var resizeModalShown = function() {
    // 40px padding on top/bottom
    var top = $('#view-ad').css('top').replace(/[^-\d\.]/g, '');
    var viewAdHeight = $(window).height() - (2 * top);
    $('#view-ad').height(viewAdHeight);
    // body height is total height minus footer minus header minus an additional 30 from padding
    var adBodyHeight = viewAdHeight - 30;
    $('.ad-body').css('max-height', adBodyHeight);
    $('.ad-body').css('height', adBodyHeight);
  };

  /**
   * Populates opts with search values based on the valid searchFields of
   * the category and user entered values (opts).
   * @param  {Array}  searchFields Value search fields for this category.
   * @param  {Object} opts         User entered search options.
   */
  var setupSearch = function(searchFields, opts) {

    var priceMin = $('#search-price-min');
    var priceMax = $('#search-price-max');
    // if price range is not allowed
    if (searchFields.indexOf('Price Range') == -1) {
      priceMin.hide();
      if (opts.pricemin) {
        delete opts.pricemin;
      }
      priceMax.hide();
      if (opts.pricemax) {
        delete opts.pricemax;
      }
    // if price range is allowed
    } else {
      priceMin.val(opts.pricemin);
      priceMin.show();
      priceMax.val(opts.pricemax);
      priceMax.show();
    }

    var pets = $('#search-pets');
    // if pets accepted is not allowed
    if (searchFields.indexOf('Pets Accepted') == -1) {
      pets.parent().hide();
      if (opts.pets) {
        delete opts.pets;
      }
    // if pets accepted is allowed
    } else {
      pets.val(opts.pets);
      pets.parent().show();
    }

    var bedrooms = $('#search-bedrooms');
    // if bedrooms is not allowed
    if (searchFields.indexOf('Bedrooms') == -1) {
      bedrooms.parent().hide();
      if (opts.bedrooms) {
        delete opts.bedrooms;
      }
    // if bedrooms is allowed
    } else {
      bedrooms.val(opts.bedrooms);
      bedrooms.parent().show();
    }
  };

  /**
   * Returns a key/value pair of the current user-entered search options.
   * @return {Object} User entered search options.
   */
  var getSearchOpts = function() {
    return {
      pets: $('#search-pets').val(),
      bedrooms: $('#search-bedrooms').val(),
      keywords: $('#search-input').val(),
      pricemin: $('#search-price-min').val(),
      pricemax: $('#search-price-max').val()
    };
  };

  /**
   * Initializes the application with any needed preferences, queries
   * a list of sites from the API, and sets to the nearest site if no
   * preferred site is set.
   * @param  {Object} prefs Key/value pairs of URL hash values.
   */
  var initApp = function(prefs) {
    prefs = prefs || {};
    requestsPending++;
    $.fn.backpage({
      object: 'Site',
      params: {
        CountryCode: 'US'
      }
    })
    .then(function(sites) {
      requestsPending--;
      // only set if no saved preferences
      if (curPos) {
        var nearestSite = findNearestSite(sites);
        if (nearestSite) {
          $('#site-input').val(nearestSite);
        }
        console.log('nearest site is ' + nearestSite);
        window.location.hash = buildHash($.extend(curOpts(), {site: nearestSite}));
      // load saved site preference
      } else {
        window.location.hash = buildHash($.extend(curOpts(), prefs));
      }
      renderHash();
      $('#site-input').removeAttr('disabled');
      $('#site-input').typeahead({

        // query sites for names matching the input
        source: function(query) {
          query = query.toLowerCase();
          var results = [];
          $.each(sites, function() {
            if (this.Name.indexOf(query) != -1) {
              results.push(this.Name);
            }
          });
          return results;
        },

        // populate the category list when a site is selected
        updater: function(site) {
          savePrefs({site: site});
          resetAdPaging();
          window.location.hash = buildHash($.extend(curOpts(), {site: site}));
          return site;
        }
      });
      $('#connection-error').hide();
    })
    .fail(function(xhr, err) {
      $('#connection-error').show();
    });
  };

  /**
   * Called when PhoneGap deviceready event is fired.  Opens the preferences db.
   */
  var deviceReady = function() {
    var db = window.openDatabase('Database', '1.0', 'Backpage Prefs', 200000);
    db.transaction(populateDB, dbError, populateSuccess);
  };

  /**
   * Creates the preferences DB if needed.
   * @param  {Object} tx Transaction object.
   */
  var populateDB = function(tx) {
    // tx.executeSql('DROP TABLE IF EXISTS prefs');
    tx.executeSql('CREATE TABLE IF NOT EXISTS prefs (id unique, value)');
  };

  /**
   * Called on successful populateDB -- whether a table is created or not.
   */
  var populateSuccess = function() {
    var db = window.openDatabase('Database', '1.0', 'Backpage Prefs', 200000);
    db.transaction(getPrefs, dbError);
  };

  /**
   * Gets preferences entry from local DB.  Preferences are stored as a
   * JSON string.
   * @param  {Object} tx Transaction object.
   */
  var getPrefs = function(tx) {
    tx.executeSql('SELECT * FROM prefs', [], prefsSuccess, dbError);
  };

  /**
   * Called on successful getPrefs().  Reads preferences and initializes
   * the application.  Attempts to detect geo location if no saved preferences
   * are found.
   * @param  {[type]} tx      Transaction object.
   * @param  {[type]} results Result set.
   */
  var prefsSuccess = function(tx, results) {
    var prefs = {};
    // found preferences, initialize with that
    if (results.rows.length) {
      prefs = JSON.parse(results.rows.item(0).value);
      initApp(prefs);
    // no preferences found, detect location
    } else {
      requestsPending++;
      navigator.geolocation.getCurrentPosition(
        // location detected successfully
        function(pos) {
          requestsPending--;
          curPos = pos;
          initApp();
        },
        // error detecting location, initialize app w/ no site selected
        function(err) {
          requestsPending--;
          initApp();
        },
        // only wait 5 seconds for geolocation
        // allow geo locations up to a day old
        {
          // timeout: 5000,
          maximumAge: 86400000
        }
      );
    }
  };

  /**
   * Save prefs to local database.
   * @param  {Object} prefs Key/value pairs to save.  Currently site is used.
   */
  var savePrefs = function(prefs) {
    var db = window.openDatabase('Database', '1.0', 'Backpage Prefs', 200000);
    db.transaction(
      function(tx) {
        tx.executeSql("DELETE FROM prefs");
        tx.executeSql("INSERT INTO prefs (id, value) VALUES (0, '" + JSON.stringify(prefs) + "')");
      }
    );
  };

  /**
   * Called if there's a db error.
   * @param  {Object} err The error object.
   */
  var dbError = function(err) {
    // console.log(err);
  };

  /**
   * Radius of Earth in miles.  Used for distance calculations.
   * @type {Number}
   */
  var R = 3961.3;

  /**
   * Calculates the distance in miles between two lat/long pairs.
   * @param  {Number} lat1D  First latitude
   * @param  {Number} long1D First longitude
   * @param  {Number} lat2D  Second latitude
   * @param  {Number} long2D Second longitude
   * @return {Number}        Distance between first and second latitude.
   */
  var calcDistance = function(lat1D, long1D, lat2D, long2D) {
    // convert to radians
    var lat1R = lat1D * Math.PI / 180.0;
    var long1R = long1D * Math.PI / 180.0;
    var lat2R = lat2D * Math.PI / 180.0;
    var long2R = long2D * Math.PI / 180.0;
    // get distance in radians
    var dLat = (lat2D - lat1D) * Math.PI / 180.0;
    var dLong = (long2D - long1D) * Math.PI / 180.0;
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1R) * Math.cos(lat2R) *
        Math.sin(dLong/2) * Math.sin(dLong/2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  var findNearestSite = function(sites) {
    var nearestSite;
    var shortestDistance = 99999999;
    $.each(sites, function(i, site) {
      var d = calcDistance(curPos.coords.latitude, curPos.coords.longitude, site.Latitude, site.Longitude);
      if (d < shortestDistance) {
        shortestDistance = d;
        nearestSite = site.Name;
      }
    });
    return nearestSite;
  };

  document.addEventListener('deviceready', function() {
    deviceReady();
  }, false);

  // handle url hash changes
  $(window).on('hashchange', function() {
    renderHash();
  });

  // populate the typeahead with all US sites
  $('#site-input').attr('disabled', 'disabled');

  // initialize masonry plugin
  $('#ads').masonry({
    itemSelector : '.ad-thumb',
    isAnimated: false,
    isFitWidth: true,
    // custom width to help center columns
    columnWidth: function( containerWidth ) {
      var width = $('#ads').parent().width();
      return width / Math.floor(width / 220);
    }
  });

  // trigger infinite scroll loading more search results
  $(window).scroll(function(e) {
    if($(window).scrollTop() + $(window).height() > $(document).height() - 100) {
      if (!isLoading) {
        isLoading = true;
        curPage++;
        renderHash();
      }
    }
  });

  // bind search button to run a search
  $('#search-button').on('click', function() {
    resetAdPaging();
    window.location.hash = buildHash($.extend(curOpts(), getSearchOpts()));
  });

  // bind search reset button to reset search options
  $('#search-reset-button').on('click', function() {
    $('.search-field').val('');
    $('#search-button').trigger('click');
  });

  // prevent scrolling of the search results when ad modal is up
  var adModalVisible = false;
  $('.modal').on('show', function() {
    adModalVisible = true;
    $('body').css('overflow', 'hidden');
    $('body').css('overflow-x', 'hidden');
    $('body').css('overflow-y', 'hidden');
    // turn off backdrop due to ios7 bugs
  })
  .on('hidden', function() {
    adModalVisible = false;
    $('body').css('overflow', 'auto');
    $('body').css('overflow-x', 'auto');
    $('body').css('overflow-y', 'auto');
  });

  // prevent scrolling of search results when ad modal is up (iOS)
  // $(document).on('touchmove', function(e) {
  //   if (adModalVisible) {
  //     var el = e.target;
  //     do {
  //       console.log(el.id);
  //       if (el.id == 'view-ad') {
  //         e.stopImmediatePropagation();
  //         e.preventDefault();
  //       }
  //     } while (el = el.parentNode);
  //   }
  // });

  // bind to show/shown events to resize modal to better fit the screen
  $('#view-ad').on('show', function(){
    resizeModalShow();
  })
  .on('shown', function() {
    resizeModalShown();
  });

  // bind to clear site input button
  $('#clear-search-button').on('click', function() {
    $('#site-input').val('');
  });

  $('#load-sites-button').on('click', function() {
    deviceReady();
  });

  // resize modal if the window is resized
  $(window).on('resize', function() {
    resizeModalShow();
    resizeModalShown();
    $('#site-input').width($('#site-input').parent().outerWidth() - $('#clear-search-button').outerWidth() - 13);
  });
  $(window).trigger('resize');

  // show the loading gif if any requests are pending
  setInterval(function() {
    if (requestsPending === 0) {
      $('.loader').css('left', '-999px');
    } else {
      $('.loader').css('left', ($(window).width() - $('.loader').width()) / 2);
    }
  }, 500);

  // initialize FastClick to avoid 300ms click delay on mobile platforms
  FastClick.attach(document.body);

  // fire deviceready manually if phonegap isn't loaded
  if (typeof device == 'undefined') {
    deviceReady();
  }

});