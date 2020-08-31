const express = require('express');
const bodyParser = require('body-parser');
const url = require('url');
const moment = require('moment');

const config = require('./config');
const doctors = require('./data/doctors');
const patients = require('./data/patients');
const comments = require('./data/comments');
const types = require('./data/types');
const sorts = require('./data/sorts');
const treatment = require('./data/treatment');

const rel_patient_doctor = require('./data/rel_patient_doctor');
const rel_treatment_doctor = require('./data/rel_treatment_doctor');

const sortTypes = require('./helper/sort-filters');
const utility = require('./helper/utility');

// create express app
const app = express();

// Setup server port
const port = process.env.PORT || 4000;

// parse requests of content-type - application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }))
// parse requests of content-type - application/json
app.use(bodyParser.json())

// CROSS-ORIGINS
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", '*'); // update to match the domain you will make the request from
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  let query = url.parse(req.url,true).query;
  if (query) req.body = { ...req.body, ...query }

  next();
});

app.use('/doctors/:id', function (req, res, next) {
  req.doctor = [].concat(doctors.list).find(f => f.id == req.params.id);
  req.doctor.extend_last_appointment = true
  next();
});

// define a root/default route
app.get('/types', (req, res) => {
  res.json({
    "types": types
  });
});

app.route('/doctors')
  .get((req, res) => {
    let list = [].concat(doctors.list);
    let page = 1 , pages = 1;
    
    req.body = url.parse(req.url,true).query;

    if (req.body.type && req.body.type !== '' && req.body.type !== 'all') {
      list = list.filter(f => f.type === req.body.type)
    }

    if (req.body.filter && typeof req.body.filter === 'string' && req.body.filter.trim() !== "") {
      list = list.filter(f => {
        const term = Object.values(f).join().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return term.indexOf(req.body.filter.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")) != -1;
      })
    }

    list.forEach((d, i) => {
      d.comments = comments.list.filter(c => c.doctor_id == d.id).length;
      d.rate = comments.list.filter(c => c.doctor_id == d.id).map(c => c.rate).reduce((a, b) => a + b, 0) / d.comments 
    })

    let total = list.length;

    if (req.body.sort && req.body.sort !== '' && sortTypes[req.body.sort]) {

      if (req.body.sort === "closest" && req.body.location) {
        list.forEach((e, i) => {
          e.distance = utility.calculateDistance(e.latitude, e.longitude, req.body.location.latitude, req.body.location.longitude, 'K')
        })
        list = list.filter(d => d.distance < 800)
      }

      list = list.sort(sortTypes[req.body.sort])
    }
    if (req.body.limit && req.body.limit > 0) {

      pages = ((total / req.body.limit) || 1);
      page = (req.body.page||1);

      if (page >= pages) 
        page = Math.ceil(pages);

      let start = req.body.limit * ((page||1)-1);
      let end = req.body.limit * (page||1);

      list = list.slice(start, Math.min(end, list.length));
    }

    res.json({
      'doctors': list,
      'paginator': {
        pages,
        page,
        total
      }
    })
  })
  .post((req, res) => {
    let list = [].concat(doctors.list)
    let page = 1 , pages = 1;
    
    if (req.body.type && req.body.type !== '' && req.body.type !== 'all') {
      list = list.filter(f => f.type === req.body.type)
    }

    if (req.body.filter && typeof req.body.filter === 'string' && req.body.filter.trim() !== "") {
      list = list.filter(f => {
        const term = Object.values(f).join().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return term.indexOf(req.body.filter.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")) != -1;
      })
    }

    list.forEach((d, i) => {
      d.comments = comments.list.filter(c => c.doctor_id == d.id).length;
      d.rate = comments.list.filter(c => c.doctor_id == d.id).map(c => c.rate).reduce((a, b) => a + b, 0) / d.comments;
    })

    if (req.body.sort && req.body.sort !== '' && sortTypes[req.body.sort]) {
      if (req.body.sort === "closest" && req.body.location) {
        list.forEach((e, i) => {
          e.distance = utility.calculateDistance(e.latitude, e.longitude, req.body.location.latitude, req.body.location.longitude, 'K')
        })
        list = list.filter(d => d.distance < 800)
      }

      list = list.sort(sortTypes[req.body.sort])
    }

    let total = list.length;

    if (req.body.limit && req.body.limit > 0) {
      pages = ((total / req.body.limit) || 1);
      page = (req.body.page||1);

      if (page >= pages) 
        page = Math.ceil(pages);

      let start = req.body.limit * ((page||1)-1);
      let end = req.body.limit * (page||1);

      list = list.slice(start, Math.min(end, list.length));
    }

    res.json({
      'doctors': list,
      'paginator': {
        pages,
        page,
        total
      }
    })
  });

app.route('/doctors/:id')
  .get((req, res) => {
    let doctor = req.doctor

    doctor.patients = rel_patient_doctor.list.filter(p => p.doctor_id == doctor.id).length;

    doctor.comments = comments.list.filter(c => c.doctor_id == doctor.id).sort(sortTypes.by_comments_date);
    doctor.rate = doctor.comments.map(c => c.rate).reduce((a, b) => a + b, 0) / doctor.comments.length;
    doctor.comments.forEach(c => {
      c.patient = patients.list.map(p => Object({ name: p.first_name, img: p.avatar, id: p.id })).find(p => p.id == c.patient_id)
    });

    doctor.treatments = rel_treatment_doctor.list.filter( p => p.doctor_id == doctor.id).map(t => {
      return {
        id: t.id,
        treatment: treatment.list.find(f => f.id == t.treatment_id)
      }
    })

    res.json({
      doctor: doctor
    })
  })

app.route('/doctors/:id/booking')
  .get((req, res) => {
    let dates = new Array(moment(req.body.start).daysInMonth()).fill(true);
    let firstDayInMonth = moment(req.body.start).startOf('month').add(-1 , 'day');
    let slot = req.doctor.date_slot
    let times = new Array(Math.ceil((24 * 60) / slot)).fill(true).map((t, ti) => moment('00:00', 'HH:mm').minute(ti * slot).format('h:mm a'))
    let start_time = moment(req.doctor.start_working, 'HH:mm a')
    let end_time = moment(req.doctor.end_working, 'HH:mm a')
    let start_date = moment().startOf('day').add(req.doctor.after_days || 0, 'day')
    let end_date = moment(start_date).startOf('day').add(req.doctor.max_days || 7, 'day')


    if (!req.doctor.extend_last_appointment) {
      end_time = end_time.add(req.doctor.date_slot * -1, 'minutes')
    }

    dates = dates.map((d, i) => {
      return { 
        date: firstDayInMonth.add(1, 'day').format('YYYY-MM-DD'), 
        times: times.filter(t => moment(t, 'HH:mm a').isBetween(start_time, end_time, null, '[]'))
      }
    })

    dates = dates.filter(d => moment(d.date, 'YYYY-MM-DD').isBetween(start_date, end_date, null, '[]'))

    res.json({
      start: start_date.format(),
      end: end_date.format(),
      slot,
      dates: dates
    })
  })

app.route('/doctors/:id/treatments')
  .get((req, res) => {
    res.json({
      treatments: treatment.list.filter(t => t.doctor_id === req.params.id)
    })
  })

app.route('/specialities')
  .get((req, res) => {
    const specialities = [].concat(doctors.list).map(d => d.speciality);
    const specialitiesByGroup = specialities.filter((t, ti) => specialities.indexOf(t) == ti).map(m => Object({ name: m, value: 0 }));

    doctors.list.forEach((e, i) => {
      const tmpT = specialitiesByGroup.find(f => f.name === e.speciality);
      if (tmpT) tmpT.value++
    });

    res.json({
      'specialities': specialitiesByGroup
    })
  })
  .post((req, res) => {
    const specialities = [].concat(doctors.list).map(d => d.speciality);
    let specialitiesByGroup = specialities.filter((t, ti) => specialities.indexOf(t) == ti).map(m => Object({ name: m, value: 0 }));

    doctors.list.forEach((e, i) => {
      const tmpT = specialitiesByGroup.find(f => f.name === e.speciality);
      if (tmpT) tmpT.value++
    });    

    if (req.body.limit && req.body.limit > 0) {
      specialitiesByGroup = specialitiesByGroup.slice(0, Math.min(req.body.limit, specialitiesByGroup.length))
    }

    if (req.body.sort && req.body.sort !== '' && sortTypes[req.body.sort] && req.body.sort === 'by_speciality') {
      specialitiesByGroup.sort(sortTypes[req.body.sort])
    }

    res.json({
      'specialities': specialitiesByGroup
    })
  });

app.route('/cities')
  .get((req, res) => {
    const cities = [].concat(doctors.list).map(m => m.city);
    const citiesByGroup = cities.filter((c, ci) => cities.indexOf(c) == ci).map(m => Object({ name: m, value: 0 }));

    doctors.list.forEach((e, i) => {
      const tmpT = citiesByGroup.find(f => f.name === e.city);
      if (tmpT) tmpT.value++
    });

    res.json({
      'cities': citiesByGroup
    })
  }).post((req, res) => {
    const cities = [].concat(doctors.list).map(m => m.city);
    let citiesByGroup = cities.filter((c, ci) => cities.indexOf(c) == ci).map(m => Object({ name: m, value: 0 }));

    doctors.list.forEach((e, i) => {
      const tmpT = citiesByGroup.find(f => f.name === e.city);
      if (tmpT) tmpT.value++
    });

    if (req.body.limit && req.body.limit > 0) {
      citiesByGroup = citiesByGroup.slice(0, Math.min(req.body.limit, citiesByGroup.length))
    }

    if (req.body.sort && req.body.sort !== '' && sortTypes[req.body.sort] && req.body.sort === 'by_city') {
      citiesByGroup.sort(sortTypes[req.body.sort])
    }

    res.json({
      'cities': citiesByGroup
    })
  });

app.get('/sorts', (req, res) => {
  res.json({
    'sorts': sorts
  });
});

app.route('/treatment')
  .get((req, res) => {
    res.json({
      treatments: treatment.list
    })
  })

app.route('/comments/:id')
  .get((req, res) => {
    res.json({
      'comments': comments.list.filter(f => f.doctor_id == req.params.id).map(c => Object({...c, patient: patients.list.map(p => Object({ id: p.id, first_name: p.first_name, last_name: p.last_name, avatar: p.avatar })).find(p => p.id == c.patient_id)}))
    })
  })

// listen for requests
app.listen(port, () => {
  console.log(`Node server is listening on port ${port}`);
});