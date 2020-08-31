module.exports = {
  most_viewed: function (a, b) {
    return b.viewed - a.viewed;
  },
  best_rated: function (a, b) {
    if (isNaN(b.rate)) b.rate = 0;
    if (isNaN(a.rate)) a.rate = 0;
    return b.rate - a.rate
  },
  oldest: function(a, b) {
    return new Date(a.birth_date) - new Date(b.birth_date)
  },
  youngest: function (a, b) {
    return new Date(b.birth_date) - new Date(a.birth_date)
  },
  closest: function (a, b) {
    return a.distance - b.distance
  },
  by_city: function(a, b) {
    const cityA = a.name.toUpperCase();
    const cityB = b.name.toUpperCase();

    let comparison = 0;
    if (cityA > cityB) {
      comparison = 1;
    } else if (cityA < cityB) {
      comparison = -1;
    }
    return comparison;
  },
  by_speciality: function(a, b) {
    const specialityA = a.name.toUpperCase();
    const specialityB = b.name.toUpperCase();

    let comparison = 0;
    if (specialityA > specialityB) {
      comparison = 1;
    } else if (specialityA < specialityB) {
      comparison = -1;
    }
    return comparison;
  },
  by_comments_date: function(a, b) {
    return new Date(b.date) - new Date(a.date)
  }
}