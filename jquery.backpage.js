/**
 * The backpage.com jQuery plugin is a simple wrapper around the backpage
 * XML API.  More information can be found here:
 *
 * https://github.com/backpage/backpage-api
 */
(function($) {

  /**
   * The default site if no site is provided.
   * @type {String}
   */
  var baseSite = 'www.backpage.com';

  /**
   * In memory cache of requests.
   * @type {Object}
   */
  var cache = {};

  /**
   * How long to cache each request type.
   * @type {Object}
   */
  var cacheTimes = {
    '/Site.xml':     60*60*24, // 1 day
    '/Section.xml':  60*60,    // 1 hour
    '/Category.xml': 60*60,    // 1 hour
    '/Search.xml':   5*60,     // 5 minutes
    '/Ad.xml':       5*60      // 5 minutes
  };

  /**
   * Query the backpage.com API.  Options are as follows:
   * 
   *   site
   *     The site to query, ie "losangeles.backpage.com".
   *     Defaults to "www.backpage.com".
   *   object
   *     The object to query, one of: Site, Category, Section, Search, Ad.
   *   params
   *     Key/value pair of URL parameters to send with the query.
   *
   * The $.ajax() call is returned so that the deferred object can be
   * chained easily.  For example:
   *
   *   $.fn.backpage({
   *     object: 'Section',
   *     site: 'losangeles.backpages.com',
   *     params: {}
   *   })
   *   .then(function(sections) {
   *     // do something with sections
   *   })
   *   .fail(function(xhr, err) {
   *     // handle the error
   *   });
   * 
   * @param  {[type]} options API request options.
   * @return {Object}         Deferred.
   */
  $.fn.backpage = function(options) {
    var settings = $.extend({
      object: 'Site',
      site: baseSite,
      params: {}
    }, options);

    /**
     * Get an item from cache.
     * @param  {Object} obj The object to use for the hash key.
     * @return {Object}     Cached object or null.
     */
    var cacheGet = function(obj) {
      var key = JSON.stringify(obj);
      if (cache.hasOwnProperty(key)) {
        var now = new Date().getTime() / 1000;
        var cachedObj = cache[key];
        // cache is stale
        if (cachedObj.cachedAt + cacheTimes[obj.object] < now) {
          delete cache[key];
          return;
        }
        return cachedObj.obj;
      }
    };

    /**
     * Sets an item to the cache.
     * @param  {[type]} settings The object to use for the hash key.
     * @param  {[type]} obj      The object to cache.
     */
    var cacheSet = function(settings, obj) {
      var cachedAt = new Date().getTime() / 1000;
      var key = JSON.stringify(settings);
      cache[key] = {
        cachedAt: cachedAt,
        obj: obj
      };
    };

    // construct url to endpoint
    settings.site = 'http://' + settings.site + '/online/api';
    settings.object = '/' + settings.object + '.xml';

    // check cache and return cached data if it's a hit
    var cachedData = cacheGet(settings);
    if (cachedData) {
      var deferred = new $.Deferred();
      deferred.resolve(cachedData);
      return deferred.promise();
    }

    // make ajax request and return deferred object
    return $.ajax({
      type: 'get',
      url: settings.site + settings.object,
      data: options.params,
      dataType: 'xml',
      crossDomain: true
    })
    .then(function(response) {
      var result = [];
      // find each <item> element
      $(response).find('item').each(function() {
        var item = {};
        // iterate through each attribute of the item
        $(this).children().each(function() {
          // remove bp: from beginning of attribute name
          var key = this.nodeName.slice(3);
          var value = $(this).text();
          // convert numeric strings to int or float
          if (value.match(/^-?\d+$/g)) {
            value = parseInt(value, 10);
          } else if (value.match(/^-?\d+\.\d+$/g)) {
            value = parseFloat(value, 10);
          }
          // if the key exists and is not an array, convert it to an array
          if (item[key] && !(item[key] instanceof Array)) {
            item[key] = [item[key], value];
          // if the key exists an is an array, add it to the array
          } else if (item[key]) {
            item[key].push(value);
          // set the key
          } else {
            item[key] = value;
          }
        });
        result.push(item);
      });
      // set the result to cache
      cacheSet(settings, result);
      return result;
    });
  };
}(jQuery));