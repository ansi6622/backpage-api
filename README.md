## The Backpage API
============

Backpage offers a public API to search its classified ad postings.  Developers are free to use it and incorporate the data into their own applications (mobile or otherwise).  Currently read-only access is provided but the ability to post is coming soon.

### Examples

A jQuery plug-in is provided to help you get started using the API as well as a fully-functional mobile application based on PhoneGap.  

### jQuery Plug-In Reference

The plug-in is a simple $.ajax() wrapper around the Backpage XML queries.  To use it, first include the plugin in your HTML file:

```html
<script src="jquery.backpage.js"></script>
````

Then call $.fn.backpage() with a set of options, for example:

```javascript
$.fn.backpage({
  site: 'losangeles.backpage.com',
  object: 'Search',
  params: {
    Keyword: 'baseball',
    Category: 1234,
    Max: 25,
    StartIndex: 100
  }
})
.then(function(ads) {
  // do something with ads
});
.fail(function(xhr, error) {
  // handle the error
});
```

### $.fn.backpage() Options
The $.fn.backpage() function takes the following options:

| Option | Description | Example | Default |
| ------ | ----------- | ------- | ------- |
| site | The site to query | _losangeles.backpage.com_ or _www.backpage.com_ when querying the Site list | _www.backpage.com_ |
| object | The object type to query | _Site_, _Section_, _Category_, _Search_ or _Ad_ | _Site_ |
| params | An object containing key/value pairs to pass to the query | { State: 'CA', CountryCode: 'US' } | {} |

### Plug-in Object Reference

#### Site
The Site request returns information about all sites.  A Site is essentially a unique URL that has its own collection of Ads and potentially Sections and Categories.  Sites have a child/parent relationship and some sites represent entire cities or regions.  You can filter the results by **State**, **CountryCode**, or **Type**.  

##### Parameters
| Parameter | Description | Example | Required | Default |
| --------- | ----------- | ------- | -------- | ------- |
| State | Two letter abbreviation of the state to filter by. | CA | No | |
| CountryCode | Two letter abbreviation of the country to filter by. | US | No | |
| Type | If set to _Parent_ only return parent sites. | Parent | No | |

##### Request Example
```javascript
$.fn.backpage({
  site: 'www.backpage.com',
  object: 'Site',
  params: {
    CountryCode: 'US'
  }
})
.then(function(sites) {
  // do something with sites
});
```

##### Response Reference
| Parameter | Description | Example |
| --------- | ----------- | ------- |
| BackpageURL | The site's full URL | http://chico.backpage.com/ |
| City | The name of the city with state abbreviation | chico, ca |
| Country | The friendly name of the country the site is in | United States |
| CountryCode | The two-letter abbreviation for the country the site is in | US |
| Id | The unique id of the site | 89437 |
| Latitude | The latitude of the city or region the site represents | 39.72849 | Longitude | The longitude of the city or region the site represents | -121.83748 |
| Name | The name of the site, used in site option | chico.backpage.com |
| Parent | The name of the parent site | upstateca.backpage.com |
| PostingURL | The URL to visit to post an ad on the site | See Response Example | 
| State | The two-letter abbreviation for the state the site is in | CA |
| StateFull | The friendly name of the state the site is in | California |
| Type | The type of site this is | Parent, Child, or Shared |


##### Response Example
```javascript
[
  {
    BackpageURL: "http://chico.backpage.com/"
    City: "chico, ca"
    Country: "United States"
    CountryCode: "US"
    Id: 89437
    Latitude: 39.72849
    Longitude: "-121.83748"
    Name: "chico.backpage.com"
    Parent: "upstateca.backpage.com"
    PostingURL: "http://posting.chico.backpage.com/online/classifieds/PostAd.html/cic/chico.backpage.com/?section=&category=&u=cic&serverName=chico.backpage.com"
    State: "CA"
    StateFull: "California"
    Type: "Shared"
  }
]
```

#### Section
The Section request returns information about the sections of the site.  Sections are top-level Categories and each Category belongs to a Section.

##### Parameters
There are no parameters for this query.

##### Request Example
```javascript
$.fn.backpage({
  site: 'losangeles.backpage.com',
  object: 'Section'
})
.then(function(sections) {
  // do something with sections
});
```

##### Response Reference
| Parameter | Description | Example |
| --------- | ----------- | ------- |
| Id | The id of the section, used to query Categories | 4378 |
| Name | The name of the section | buy, sell, trade |
| Position | The order this section is displayed in on www.backpage.com | 3 |
| SearchFields | An array of valid search options for this section and its categories | ['Category', 'Keywords', 'Price Range'] |
| ShortName: | A shorter name for the category | buy/ sell/ trade

##### Response Example
```javascript
[
  {
    Id: 4378,
    Name: "buy, sell, trade",
    Position: 3,
    SearchFields: ['Category', 'Keywords', 'Price Range']
    ShortName: "buy/ sell/ trade"
  }
]
```

#### Category
The Category request returns information about the categories belonging to a section of the site.  This data is unique per site and can change frequently.  It is recommend that you do not cache this data for more than a day.

##### Parameters
| Parameter | Description | Example | Required | Default |
| --------- | ----------- | ------- | -------- | ------- |
| Section | The Id of the section to query | 4378 | Yes | N/A |

##### Request Example
```javascript
$.fn.backpage({
  site: 'losangeles.backpage.com',
  object: 'Category',
  params: {
    Section: 4378
  }
})
.then(function(categories) {
  // do something with categories
});
```

##### Response Reference
| Parameter | Description | Example |
| --------- | ----------- | ------- |
| CategoryKey | The UID key for the category | ElectronicsForSale |
| Id | The id of the category on the current site | 4424 |
| Name | The name of the category | electronics |
| Position | The order this category is displayed in on www.backpage.com | 5 |
| Section | The id of the section this category belongs to | 4378 |
| Settings | Settings specific to this category | ['Display Sponsor Images', 'Moderated'] |
| SearchFields | An array of valid search options for this section and its categories | ['Category', 'Keywords', 'Price Range'] |
| ShortName: | A shorter name for the category | buy/ sell/ trade

##### Possible values for Settings
Current possible values are:

Age Verification - Requires age verification during the post ad process.
Display Sponsor Images - Displays sponsor images on the search results page
Limited Ad Length - Limit to the ad length when posting.
Moderated - If this category is moderated or not.
Phone Required - If a phone number is required while posting.
Simple HTML Only - Limited HTML only (bold, italic, link, breaks, paragraphs, underlines).
Use Regions - This is ad posting related.

##### Response Example
```javascript
[
  {
    CategoryKey: "ElectronicsForSale"
    Id: 4424
    Name: "electronics"
    Position: 5
    Section: 4378
    Settings: ["Display Sponsor Images", "Moderated"],
    ShortName: "computer/electronics"
  }
]
```

#### Search
The Search request finds ads in a given section or category with a few optional filters.  A section or category are required and you must provide a site option (ie. not www.backpage.com).  The Bedrooms, PetsAccepted, PriceMin, and PriceMax parameters can be used if the section supports them.  The section's SearchFields can be used to determine which are available.

##### Parameters
| Parameter | Description | Example | Required | Default |
| --------- | ----------- | ------- | -------- | ------- |
| Section | The Id of the section to query | 4378 | Yes | N/A |
| Category | The Id of the section to query | 4424 | Yes | N/A |
| Keyword | Keywords to search for | computers | No | |
| Max | The number of results to return | 25 | No | 100 |
| StartIndex | The offset to start at | 50 | No | 0 |
| Bedrooms | Used in real estate / rentals categories, can be Studio or 1-8 | 3 | No | |
| PetsAccepted | Used in rentals categories, can be Cats OK or Dogs OK | Cats OK | No | |
| PriceMin | Used in a few sections, dollar (or local currency) amount | 100000 | No | |
| PriceMax | Used in a few sections, dollar (or local currency) amount | 300000 | No | |

##### Request Example
```javascript
$.fn.backpage({
  site: 'losangeles.backpage.com',
  object: 'Search',
  params: {
    Keyword: 'baseball',
    Category: 1234,
    Max: 25,
    StartIndex: 100
  }
})
.then(function(ads) {
  // do something with ads
});
```

##### Response Reference
| Parameter | Description | Example |
| --------- | ----------- | ------- |
| Ad | Text from the ad | CASH PRICE SALE ECHO BLOWOUT SALE CHAIN SAWS CS-30... |
| Category | The id of the category the ad belongs to | 9085882 |
| Id | The id of the ad | 29655215 |
| PostingTime | Timestamp of when the ad was posted | 2013-06-12 10:35:11 |
| Region | The region the ad is relevant for, user-entered | West Side |
| Section | The id of the section that the ad belongs to | 4378 |
| Title | The ad's title text | Sale on Echo, Husqvarna, TMC, ... |

##### Response Example
```javascript
[
  {
    Ad: "CASH PRICE SALE ECHO BLOWOUT SALE CHAIN SAWS CS-30..."
    Category: 9085882
    Id: 29655215
    PostingTime: "2013-06-12 10:35:11"
    Region: "West Side"
    Section: 4378
    Title: "Sale on Echo, Husqvarna, TMC, ..."  
  }
]
```

#### Ad
The Ad request pulls detailed information on a particular ad.

##### Parameters
| Parameter | Description | Example | Required | Default |
| --------- | ----------- | ------- | -------- | ------- |
| Id | The Id of the ad to query | 28683916 | Yes | N/A |

##### Request Example
```javascript
$.fn.backpage({
  site: 'losangeles.backpage.com',
  object: 'Ad',
  params: {
    Id: 28683916
  }
})
.then(function(ads) {
  // do something with ads
});
```

##### Response Reference
| Parameter | Description | Example |
| --------- | ----------- | ------- |
| Ad | Body text of the ad | Get your new Tint Teacup Puppy where all the celebrities... |
| Age | The age of the poster | 0 |
| AllowReplies | If the poster allows replies, possible values: "Show Email", "Anonymous", "No" | "No" |
| Bedrooms | The number of bedrooms, possible values: "", 1, 2, ... 8 or "Studio" | "" |
| Category | The id of the category the ad belongs to | 4428 |
| Id | The id of the ad | 28683916 |
| Image | Array of image URLs for the ad | ["http://images2.backpage....", "http://images3.backpage.com..."] |
| MapAddress | An address related to the ad | "6910 Bertrand Ave at USA" |
| MapZip | A zipcode related to the ad | 91335 |
| PostingTime | The timestamp of when the ad was posted | "2013-06-17 11:02:04" |
| Price | The cost of the good or service being offered | 1200 |
| Section | The id of the section the ad belongs to | 4378 |
| SponsorAd | If the ad is a sponsored ad or not | "Yes" |
| Title | The title of the ad | "TINY TEACUP PUPPIES - Yorkies - Maltese..." |

##### Response Example
```javascript
[
  {
    Ad: "Get your new Tint Teacup Puppy where all the celebrities...",
    Age: 0,
    AllowReplies: "No",
    Bedrooms: "",
    Category: 4428,
    Id: 28683916,
    Image: [
      "http://images2.backpage.com/imager/u/medium/54583479/p_Yorkie_Puppy_in_Los_Angeles_CA__1_.jpg",
      "http://images3.backpage.com/imager/u/medium/54583483/_Maltese_Puppy_in_Los_Angeles_CA__5_.jpg",
      "http://images3.backpage.com/imager/u/medium/54583486/hih-Tzu_Puppy_in_Los_Angeles_CA__11_.jpg"
    ],
    MapAddress: "6910 Bertrand Ave at USA",
    MapZip: 91335,
    PostingTime: "2013-06-17 11:02:04",
    Price: 1200,
    Section: 4378,
    SponsorAd: "Yes",
    Title: "TINY TEACUP PUPPIES - Yorkies - Maltese..."
  }
]
```
