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
  var routeHash = function() {
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
        // render and show category selector
        renderCategories(opts.site, sections, categories);
        $('#categories-toggle-container').show();
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
          // infinite scroll calls routeHash() to load more images so don't
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
            requestsPending--;
            renderAds({
              ads: ads,
              site: opts.site,
              categories: categories
            });
          });
          // show search filter
          $('#search-toggle-container').show();
        // no category selected
        } else {
          removeAds();
          // hide search filter
          $('#search-toggle-container').hide();
          // open category selector
          $('#categories-toggle-content').collapse('toggle');
        }
      });
    }
  };

  /**
   * Loads sections and categories for a given site.
   * @param  {String} site The site to load from.
   * @return {Object}      Deferred object.
   */
  var loadCategories = function(site) {
    return $.when(
      $.fn.backpage({
        site: site,
        object: 'Section'
      }),
      $.fn.backpage({
        site: site,
        object: 'Category'
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
            // close categories list
            $('#categories-toggle-content').collapse('toggle');
            curPage = 0;
            window.location.hash = buildHash(opts);
          });
        // no disclaimer
        } else {
            // close categories list
          $('#categories-toggle-content').collapse('toggle');
          curPage = 0;
          window.location.hash = buildHash(opts);
        }
      });
    });
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
      html.find('a').off('click');
      html.find('a').on('click', function(e) {
        e.preventDefault();
        // load ad details
        loadAd({
          id: $(this).data('id'),
          site: opts.site
        })
        .then(function(ads) {
          // render ad details
          renderAd(ads.pop(), opts.categories, opts.site);
        });
      });
      // append ads to container and notify masonry
      container.append(html).masonry('appended', html);
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
    // scroll to top of ad modal body
    $('.ad-body').scrollTop(0);
    $('.ad-title').text(ad.Title);
    $('.ad-text').html(ad.Ad);
    $('.ad-posted-at').text(moment(ad.PostingTime).fromNow());
    $('.ad-region').text(ad.Region);
    $('.full-ad-link').off('click');
    $('.full-ad-link').on('click', function(e) {
      e.preventDefault();
      window.open(ad.AdUrl, '_blank', 'location=yes');
    });
    // show map link
    if (ad.MapAddress && ad.MapZip) {
      var mapUrl = "http://maps.google.com/maps?q=" + encodeURIComponent(ad.MapAddress) + " " + ad.MapZip;
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
      var replyUrl = 'http://posting.' + site;
      // find category the ad is in to get CategoryKey for replyUrl
      $.each(categories, function(e, category) {
        if (category.Id == ad.Category) {
          replyUrl += '/' + category.CategoryKey + '/classifieds/Reply?oid=' + ad.Id;
          $('.reply-link').off('click');
          $('.reply-link').on('click', function(e) {
            e.preventDefault();
            window.open(replyUrl, '_blank', 'location=yes');
          });
          $('.reply-link').show();
        }
      });
    }
    // show poster's age
    if (ad.Age) {
      $('.ad-age-container').show();
      $('.ad-age').text(ad.Age);
    } else {
      $('.ad-age-container').hide();
    }
    // show number of bedrooms
    if (ad.Bedrooms) {
      $('.ad-bedrooms-container').show();
      $('.ad-bedrooms').text(ad.Bedrooms);
    } else {
      $('.ad-bedrooms-container').hide();
    }
    // show price
    if (ad.Price) {
      $('.ad-price-container').show();
      $('.ad-price').text(ad.Price);
    } else {
      $('.ad-price-container').hide();
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
    if ($(window).width() < 480) {
      $('#view-ad').width($(window).width() - 20);
    } else {
      $('#view-ad').width($(window).width() - 40);
    }
    if ($(window).width() >= 768) {
      $('#view-ad').css('margin-left', -(($(window).width() - 40) / 2));
    } else {
      $('#view-ad').css('margin-left', 0);
    }
    $('#view-ad').css('top', $('body').scrollTop() + 15);
    // $('#view-ad').css('top', '15px');
  };

  /**
   * Called when the window is resized or the ad modal's 'shown' event 
   * is fired.  Adjust the height of the modal to better fit the screen.
   */
  var resizeModalShown = function() {
    var viewAdHeight = $(window).height() - 80;
    $('#view-ad').height(viewAdHeight);
    var adBodyHeight = viewAdHeight - $('#view-ad .modal-header').height() - $('#view-ad .modal-footer').height() - 30;
    $('.ad-body').css('max-height', adBodyHeight);
    $('.ad-body').css('height', adBodyHeight);
    // console.log
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

  // handle url hash changes
  $(window).on('hashchange', function() {
    routeHash();
  });

  // populate the typeahead with all US sites
  $('#site-input').attr('disabled', 'disabled');
  requestsPending++;
  $.fn.backpage({
    object: 'Site',
    params: {
      Country: 'US'
    }
  })
  .then(function(sites) {
    requestsPending--;
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
        window.location.hash = buildHash($.extend(curOpts(), {site: site}));
        return site;
      }
    });
  });

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
        routeHash();
      }
    }
  });

  // run a search
  $('#search-button').on('click', function() {
    $('#search-toggle-content').collapse('toggle');
    curPage = 0;
    window.location.hash = buildHash($.extend(curOpts(), getSearchOpts()));
  });

  // reset current search options
  $('#search-reset-button').on('click', function() {
    $('.search-field').val('');
    $('#search-button').trigger('click');
  });

  // prevent scrolling of the search results when ad modal is up
  $('.modal').on('show', function() {
    $('body').css('overflow', 'hidden');
  })
  .on('hidden', function() {
    $('body').css('overflow', 'auto');
  });

  // bind to show/shown events to resize modal to better fit the screen
  $('#view-ad').on('show', function(){
    resizeModalShow();
  })
  .on('shown', function() {
    resizeModalShown();
  });

  // resize modal if the window is resized
  $(window).on('resize', function() {
    resizeModalShow();
    resizeModalShown();
  });

  // show the loading gif if any requests are pending
  setInterval(function() {
    if (requestsPending === 0) {
      $('.loader').hide();
    } else {
      $('.loader').show();
    }
  }, 500);

  // load the current hash
  routeHash();
});