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

    settings.site = 'http://' + settings.site + '/online/api';
    settings.object = '/' + settings.object + '.xml';

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
      return result;
    });
  };
}(jQuery));