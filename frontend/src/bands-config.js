// Band configuration for radio frequencies
// This file defines all the radio bands with their properties

const MODES = {
  AM: 'AM',
  FM: 'FM',
  LSB: 'LSB',
  USB: 'USB',
  CW: 'CW-U',
  DIGITAL: 'DIGITAL'
};

const bands = [
	{ ITU: 123,
	    name: 'VLF', min: -30, max: 110, initFreq: '', publishBand: '2', startFreq: 3000, endFreq: 30000,  stepi: 1000, color: 'rgba(199, 12, 193, 0.6)',
	    modes: [{ mode:MODES.CW, startFreq: 3000, endFreq: 30000 }]
	},
	{ ITU: 123,
	    name: 'LF', min: -30, max: 110, initFreq: '77500', publishBand: '2', startFreq: 30000, endFreq: 135000,  stepi: 1000, color: 'rgba(199, 12, 193, 0.6)',
	    modes: [{ mode: MODES.CW, startFreq: 30000, endFreq: 135000 }]
	},
	{ ITU: 123,
	    name: '2200m', min: -30, max: 110, initFreq: '135700', publishBand: '1', startFreq: 135700, endFreq: 137800,  stepi: 100, color: 'rgba(50, 168, 72, 0.6)',
            modes: [{ mode: MODES.CW, startFreq: 135700, endFreq: 137800 }]
	},
	{ ITU: 123,
	    name: '', min: -30, max: 110, initFreq: '', publishBand: '', startFreq: 137800, endFreq: 148500, stepi: 1000, color: '#ffffff00',
            modes: [{ mode: MODES.USB, startFreq: 137800, endFreq: 148500 }]
	},
	{ ITU: 123,
	    name: 'LW', min: -30, max: 110, initFreq: '225000', publishBand: '2', startFreq: 148500, endFreq: 283500,  stepi: 9000, color: 'rgba(199, 12, 193, 0.6)',
            modes: [{ mode: MODES.AM, startFreq: 148500, endFreq: 283500 }]
	},
	{ ITU: 123,
	    name: '', min: -30, max: 110, initFreq: '', publishBand: '', startFreq: 283500, endFreq: 472000, stepi: 1000, color: '#ffffff00',
            modes: [{ mode: MODES.USB, startFreq: 283500, endFreq: 472000 }]
	},
	{ ITU: 123,
	    name: '630m', min: 5, max: 110, initFreq: '', publishBand: '1', startFreq: 472000, endFreq: 479000,  stepi: 100, color: 'rgba(50, 168, 72, 0.6)', 
            modes: [
              { mode: MODES.CW, startFreq: 472000, endFreq: 475000 },
              { mode: MODES.USB, startFreq: 475000, endFreq: 479000 }]
	},
	{ ITU: 123,
	    name: '600m', min: -10, max: 110, initFreq: '', publishBand: '1', startFreq: 501000, endFreq: 504000,  stepi: 100, color: 'rgba(50, 168, 72, 0.6)', 
            modes: [{ mode: MODES.CW, startFreq: 501000, endFreq: 504000 }]
	},
        { ITU: 1,
            name: 'MW', min: -10, max: 110, initFreq: '729000', publishBand: '2', startFreq: 531000, endFreq: 1611000, stepi: 9000, color: 'rgba(199, 12, 193, 0.6)',
            modes: [{ mode: MODES.AM, startFreq: 531000, endFreq: 1611000 }]
        },
        { ITU: 2,
            name: 'MW', min: -10, max: 110, initFreq: '', publishBand: '2', startFreq: 530000, endFreq: 1700000, stepi: 10000, color: 'rgba(199, 12, 193, 0.6)',
            modes: [{ mode: MODES.AM, startFreq: 530000, endFreq: 1700000 }]
        },
        { ITU: 3,
            name: 'MW', min: -10, max: 110, initFreq: '', publishBand: '2', startFreq: 531000, endFreq: 1700000, stepi: 9000, color: 'rgba(199, 12, 193, 0.6)',
            modes: [{ mode: MODES.AM, startFreq: 531000, endFreq: 1700000 }]
        },
        { ITU: 1,
            name: '180m AM', min: -10, max: 110, initFreq: '1640000', publishBand: '2', startFreq: 1611000, endFreq: 1800000, stepi: 5000, color: 'rgba(19, 106, 236, 0.6)',
            modes: [{ mode: MODES.AM, startFreq: 1611000, endFreq: 1800000 }]
        },
        { ITU: 3,
            name: '180m AM', min: -10, max: 110, initFreq: '', publishBand: '2', startFreq: 1611000, endFreq: 1800000, stepi: 5000, color: 'rgba(19, 106, 236, 0.6)',
            modes: [{ mode: MODES.AM, startFreq: 1611000, endFreq: 1800000 }]
        },
        { ITU: 123, 
            name: '160m', min: -10, max: 110, initFreq: '1910000', publishBand: '1', startFreq: 1800000, endFreq: 2000000, stepi: 1000, color: 'rgba(50, 168, 72, 0.6)', 
            modes: [
              { mode: MODES.CW, startFreq: 1800000, endFreq: 1840000 },
              { mode: MODES.LSB, startFreq: 1840000, endFreq: 2000000 }]
	}, 
       	{ ITU: 123,
	    name: '120m', min: -10, max: 110, initFreq: '', publishBand: '', startFreq: 2000000, endFreq: 2899000, stepi: 1000, color: '#ffffff00',
            modes: [{ mode: MODES.USB, startFreq: 2000000, endFreq: 2899000 }]
  },
        { ITU: 123,
       name: 'Troika', min: -10, max: 110, initFreq: '', publishBand: '', startFreq: 2900000, endFreq: 3300000, stepi: 1000, color: '#ffffff00',
            modes: [{ mode: MODES.AM, startFreq: 2900000, endFreq: 3300000 }]            
	},
        { ITU: 123,
          name: '90m', min: -10, max: 110, initFreq: '', publishBand: '', startFreq: 3301000, endFreq: 3425000, stepi: 1000, color: '#ffffff00',
              modes: [{ mode: MODES.USB, startFreq: 3301000, endFreq: 3425000 }]            
  },
       	{ ITU: 123,
        name: 'Pirates 85m', min: -30, max: 110, initFreq: '', publishBand: '', startFreq: 3425000, endFreq: 3499000, stepi: 1000, color: '#ffffff00',
              modes: [{ mode: MODES.LSB, startFreq: 3425000, endFreq: 3499000 }]
	},
	{ ITU: 1,
            name: '80m', min: -30, max: 110, initFreq: '3685000', publishBand: '1', startFreq: 3500000, endFreq: 3800000,  stepi: 1000, color: 'rgba(50, 168, 72, 0.6)',
            modes: [
              { mode: MODES.CW, startFreq: 3500000, endFreq: 3600000 },
              { mode: MODES.LSB, startFreq: 3600000, endFreq: 3800000 }]
        },
	{ ITU: 2,
            name: '80m', min: -30, max: 110, initFreq: '', publishBand: '1', startFreq: 3500000, endFreq: 4000000,  stepi: 1000, color: 'rgba(50, 168, 72, 0.6)',
            modes: [
              { mode: MODES.CW, startFreq: 3500000, endFreq: 3600000 },
              { mode: MODES.LSB, startFreq: 3600000, endFreq: 4000000 }]
        },
	{ ITU: 3,
            name: '80m', min: -30, max: 110, initFreq: '', publishBand: '1', startFreq: 3500000, endFreq: 3800000,  stepi: 1000, color: 'rgba(50, 168, 72, 0.6)', 
            modes: [
              { mode: MODES.CW, startFreq: 3500000, endFreq: 3600000 },
              { mode: MODES.LSB, startFreq: 3600000, endFreq: 3800000 }]
	},
        { ITU: 1,
            name: '80m IARU 2', min: -30, max: 110, initFreq: '', publishBand: '', startFreq: 3800000, endFreq: 3900000, stepi: 1000, color: '#ffffff00',
            modes: [{ mode: MODES.LSB, startFreq: 3800000, endFreq: 3900000 }]
        },
        { ITU: 3,
          name: '80m IARU 2', min: -30, max: 110, initFreq: '', publishBand: '', startFreq: 3800000, endFreq: 3900000, stepi: 1000, color: '#ffffff00',
          modes: [{ mode: MODES.LSB, startFreq: 3800000, endFreq: 3900000 }]
        },
        { ITU: 1,
            name: '75m AM', min: -30, max: 110, initFreq: '3955000', publishBand: '2', startFreq: 3901000, endFreq: 4000000,  stepi: 5000, color: 'rgba(199, 12, 193, 0.6)', 
            modes: [{ mode: MODES.AM, startFreq: 3901000, endFreq: 4000000 }]
        },
        { ITU: 3,
            name: '75m AM', min: -30, max: 110, initFreq: '', publishBand: '2', startFreq: 3901000, endFreq: 4000000,  stepi: 5000, color: 'rgba(199, 12, 193, 0.6)', 
            modes: [{ mode: MODES.AM, startFreq: 3901000, endFreq: 4000000 }]
        },
        { ITU: 1,
            name: 'Maritime', min: -30, max: 110, initFreq: '', publishBand: '', startFreq: 4000000, endFreq: 5351500, stepi: 1000, color: '#ffffff00',
            modes: [{ mode: MODES.USB, startFreq: 4000000, endFreq: 5351500 }]
        },
        { ITU: 2,
            name: 'Maritime', min: -30, max: 110, initFreq: '', publishBand: '', startFreq: 4000000, endFreq: 5330500, stepi: 1000, color: '#ffffff00',
            modes: [{ mode: MODES.USB, startFreq: 4000000, endFreq: 5330500 }]
        },
        { ITU: 3,
            name: 'Maritime', min: -30, max: 110, initFreq: '', publishBand: '', startFreq: 4000000, endFreq: 5351500, stepi: 1000, color: '#ffffff00',
            modes: [{ mode: MODES.USB, startFreq: 4000000, endFreq: 5351500, }]
        }, 
  { ITU: 1,
            name: '60m', min: -30, max: 110, initFreq: '5360000', publishBand: '1', startFreq: 5351500, endFreq: 5366650,  stepi: 1000, color: 'rgba(50, 168, 72, 0.6)',
            modes: [
              { mode: MODES.CW, startFreq: 5351500, endFreq: 5354000 },
              { mode: MODES.USB, startFreq: 5354000, endFreq: 5366500 }]
        },
	{ ITU: 2,
            name: '60m', min: -30, max: 110, initFreq: '', publishBand: '1', startFreq: 5330500, endFreq: 5406500,  stepi: 1000, color: 'rgba(50, 168, 72, 0.6)',
            modes: [{ mode: MODES.USB, startFreq: 5330500, endFreq: 5406500 }]
        },
	{ ITU: 3,
            name: '60m', min: -30, max: 110, initFreq: '', publishBand: '1', startFreq: 5351500, endFreq: 5366650,  stepi: 1000, color: 'rgba(50, 168, 72, 0.6)',
            modes: [
              { mode: MODES.CW, startFreq: 5351500, endFreq: 5354000 },
              { mode: MODES.USB, startFreq: 5354000, endFreq: 5366500 }]
        },
  { ITU: 123,
	          name: 'Aeronautical', min: -30, max: 110, initFreq: '', publishBand: '', startFreq: 5406500, endFreq: 5900000, stepi: 1000, color: '#ffffff00',
            modes: [{ mode: MODES.USB, startFreq: 5406500, endFreq: 5900000 }]
	},
	{ ITU: 123,
            name: '49m AM', min: -30, max: 110, initFreq: '', publishBand: '2', startFreq: 5900000, endFreq: 6200000,  stepi: 5000, color: 'rgba(199, 12, 193, 0.6)', 
            modes: [{ mode: MODES.AM, startFreq: 5900000, endFreq: 6200000 }]
	},
       	{ ITU: 123,
	    name: 'Maritime', min: -30, max: 110, initFreq: '', publishBand: '', startFreq: 6200000, endFreq: 6610000, stepi: 1000, color: '#ffffff00',
            modes: [{ mode: MODES.USB, startFreq: 6200000, endFreq: 6610000 }]
	},
       	{ ITU: 123,
	          name: 'Pirates 45m', min: -30, max: 110, initFreq: '', publishBand: '', startFreq: 6610000, endFreq: 6760000, stepi: 1000, color: '#ffffff00',
            modes: [{ mode: MODES.LSB, startFreq: 6610000, endFreq: 6760000 }]
	},
        { ITU: 123,
            name: 'Aeronautical', min: -30, max: 110, initFreq: '', publishBand: '', startFreq: 6760000, endFreq: 6999000, stepi: 1000, color: '#ffffff00',
            modes: [{ mode: MODES.USB, startFreq: 6760000, endFreq: 6999000 }]
        }, 
	{ ITU: 1,
            name: '40m', min: -30, max: 110, initFreq: '7120000', publishBand: '1', startFreq: 7000000, endFreq: 7200000,  stepi: 1000, color: 'rgba(50, 168, 72, 0.6)', 
	    modes: [
              { mode: MODES.CW, startFreq: 7000000, endFreq: 7040000 },
              { mode: MODES.LSB, startFreq: 7040000, endFreq: 7200000 }]
	},
	{ ITU: 2,
            name: '40m', min: -30, max: 110, initFreq: '', publishBand: '1', startFreq: 7000000, endFreq: 7300000,  stepi: 1000, color: 'rgba(50, 168, 72, 0.6)', 
	    modes: [
              { mode: MODES.CW, startFreq: 7000000, endFreq: 7050000 },
              { mode: MODES.LSB, startFreq: 7050000, endFreq: 7300000 }]
	},
	{ ITU: 3,
            name: '40m', min: -30, max: 110, initFreq: '', publishBand: '1', startFreq: 7000000, endFreq: 7200000,  stepi: 1000, color: 'rgba(50, 168, 72, 0.6)',
            modes: [
              { mode: MODES.CW, startFreq: 7000000, endFreq: 7040000 },
              { mode: MODES.LSB, startFreq: 7040000, endFreq: 7200000 }]
        },
        { ITU: 1,  
            name: '41m AM', min: -30, max: 110, initFreq: '', publishBand: '2', startFreq: 7201000, endFreq: 7449000,  stepi: 5000, color: 'rgba(199, 12, 193, 0.6)', 
            modes: [{ mode: MODES.AM, startFreq: 7201000, endFreq: 7450000 }]
	      },
	      { ITU: 2,
            name: '41m AM', min: -30, max: 110, initFreq: '', publishBand: '2', startFreq: 7301000, endFreq: 7449000,  stepi: 5000, color: 'rgba(199, 12, 193, 0.6)', 
            modes: [{ mode: MODES.AM, startFreq: 7301000, endFreq: 7450000 }]
	      },
        { ITU: 3,
            name: '41m AM', min: -30, max: 110, initFreq: '', publishBand: '2', startFreq: 7201000, endFreq: 7449000,  stepi: 5000, color: 'rgba(199, 12, 193, 0.6)',
            modes: [{ mode: MODES.AM, startFreq: 7201000, endFreq: 7450000 }]
        },
        { ITU: 123,
	    name: '', min: -30, max: 110, initFreq: '', publishBand: '', startFreq: 7450000, endFreq: 9400000, stepi: 1000, color: '#ffffff00',
            modes: [{ mode: MODES.USB, startFreq: 7450000, endFreq: 9400000 }]
	},
	{ ITU: 123,
            name: '31m AM', min: -30, max: 110, initFreq: '', publishBand: '2', startFreq: 9400000, endFreq: 9900000,  stepi: 5000, color: 'rgba(199, 12, 193, 0.6)', 
            modes: [{ mode: MODES.AM, startFreq: 9400000, endFreq: 9900000 }]
	},
	{ ITU: 123,
	    name: 'Aeronautical', min: -30, max: 110, initFreq: '', publishBand: '', startFreq: 9900000, endFreq: 10100000, stepi: 1000, color: '#ffffff00',
            modes: [{ mode: MODES.USB, startFreq: 9900000, endFreq: 10100000 }]
	},
	{ ITU: 123,
            name: '30m', min: -30, max: 110, initFreq: '10136000', publishBand: '1', startFreq: 10100000, endFreq: 10150000,  stepi: 1000, color: 'rgba(50, 168, 72, 0.6)', 
	    modes: [{ mode: MODES.CW, startFreq: 10100000, endFreq: 10150000 }]
	},
	{ ITU: 123,
	    name: 'Aeronautical', min: -30, max: 110, initFreq: '', publishBand: '', startFreq: 10150000, endFreq: 11600000, stepi: 1000, color: '#ffffff00',
            modes: [{ mode: MODES.USB, startFreq: 10150000, endFreq: 11600000 }]
	},
	{ ITU: 123,
            name: '25m AM', min: -30, max: 110, initFreq: '', publishBand: '2', startFreq: 11600000, endFreq: 12200000,  stepi: 5000, color: 'rgba(199, 12, 193, 0.6)', 
            modes: [{ mode: MODES.AM, startFreq: 11600000, endFreq: 12200000 }]
	},
	{ ITU: 123,
	    name: 'Marintime', min: -30, max: 110, initFreq: '', publishBand: '', startFreq: 12200000, endFreq: 13570000, stepi: 1000, color: '#ffffff00',
            modes: [{ mode: MODES.USB, startFreq: 12200000, endFreq: 13570000 }]
	},
	{ ITU: 123,
            name: '22m AM', min: -30, max: 110, initFreq: '', publishBand: '2', startFreq: 13570000, endFreq: 13870000,  stepi: 5000, color: 'rgba(199, 12, 193, 0.6)', 
            modes: [{ mode: MODES.AM, startFreq: 13570000, endFreq: 13870000 }]
	},
	{ ITU: 123,
	    name: 'Marintime', min: -30, max: 110, initFreq: '', publishBand: '', startFreq: 13870000, endFreq: 13870000, stepi: 1000, color: '#ffffff00',
            modes: [{ mode: MODES.USB, startFreq: 13870000, endFreq: 13870000 }]
	},
	{ ITU: 123,
            name: '20m', min: -30, max: 110, initFreq: '14280000', publishBand: '1', startFreq: 14000000, endFreq: 14350000,  stepi: 1000, color: 'rgba(50, 168, 72, 0.6)', 
	    modes: [
              { mode: MODES.CW, startFreq: 14000000, endFreq: 14070000 },
              { mode: MODES.USB, startFreq: 14070000, endFreq: 14350000 }]
	},
	{ ITU: 123,
	    name: '', min: -30, max: 110, initFreq: '', publishBand: '', startFreq: 14350000, endFreq: 15100000, stepi: 1000, color: '#ffffff00',
            modes: [{ mode: MODES.USB, startFreq: 14350000, endFreq: 15100000 }]
	},
	{ ITU: 123,
            name: '19m AM', min: -30, max: 110, initFreq: '', publishBand: '2', startFreq: 15100000, endFreq: 15830000,  stepi: 5000, color: 'rgba(199, 12, 193, 0.6)', 
            modes: [{ mode: MODES.AM, startFreq: 15100000, endFreq: 15830000 }]
	},
	{ ITU: 123,
	    name: '', min: -30, max: 110, initFreq: '', publishBand: '', startFreq: 15830000, endFreq: 17480000, stepi: 1000, color: '#ffffff00',
            modes: [{ mode: MODES.USB, startFreq: 15830000, endFreq: 17480000 }]
	},
	{ ITU: 123,
            name: '16m AM', min: -30, max: 110, initFreq: '', publishBand: '2', startFreq: 17480000, endFreq: 17900000,  stepi: 5000, color: 'rgba(199, 12, 193, 0.6)', 
            modes: [{ mode: MODES.AM, startFreq: 17480000, endFreq: 17900000 }]
	},
	{ ITU: 123,
	    name: '', min: -30, max: 110, initFreq: '', publishBand: '', startFreq: 17900000, endFreq: 18068000, stepi: 1000, color: '#ffffff00',
            modes: [{ mode: MODES.USB, startFreq: 17900000, endFreq: 18068000 }]
	},
	{ ITU: 123,
            name: '17m', min: -30, max: 110, initFreq: '18100000', publishBand: '1', startFreq: 18068000, endFreq: 18168000,  stepi: 1000, color: 'rgba(50, 168, 72, 0.6)', 
            modes: [
              { mode: MODES.CW, startFreq: 18068000, endFreq: 18099000 },
              { mode: MODES.USB, startFreq: 18100000, endFreq: 18168000 }]
	},
	{ ITU: 123,
	    name: '', min: -30, max: 110, initFreq: '', publishBand: '', startFreq: 18168000, endFreq: 18900000, stepi: 1000, color: '#ffffff00',
            modes: [{ mode: MODES.USB, startFreq: 18168000, endFreq: 18900000 }]
	},
	{ ITU: 123,
            name: '15m AM', min: -30, max: 110, initFreq: '', publishBand: '2', startFreq: 18900000, endFreq: 19020000,  stepi: 5000, color: 'rgba(199, 12, 193, 0.6)', 
	    modes: [{ mode: MODES.AM, startFreq: 18900000, endFreq: 19020000 }]
	},
	{ ITU: 123,
	    name: '', min: -30, max: 110, initFreq: '', publishBand: '', startFreq: 19020000, endFreq: 21000000, stepi: 1000, color: '#ffffff00',
            modes: [{ mode: MODES.USB, startFreq: 19020000, endFreq: 21000000 }]
	},
	{ ITU: 123,
            name: '15m', min: -30, max: 110, initFreq: '21074000', publishBand: '1', startFreq: 21000000, endFreq: 21450000,  stepi: 1000, color: 'rgba(50, 168, 72, 0.6)', 
	    modes: [
              { mode: MODES.CW, startFreq: 21000000, endFreq: 21070000 },
              { mode: MODES.USB, startFreq: 21070000, endFreq: 21450000 }]
	},
	{ ITU: 123,
            name: '13m AM', min: -30, max: 110, initFreq: '', publishBand: '2', startFreq: 21450000, endFreq: 21850000,  stepi: 5000, color: 'rgba(199, 12, 193, 0.6)', 
            modes: [{ mode: MODES.AM, startFreq: 21450000, endFreq: 21850000 }]
	},
	{ ITU: 123,
	        name: '', min: -30, max: 110, initFreq: '', publishBand: '', startFreq: 21850000, endFreq: 24890000, stepi: 1000, color: '#ffffff00',
            modes: [{ mode: MODES.USB, startFreq: 21850000, endFreq: 24890000 }]
	},
	{ ITU: 123,
            name: '12m', min: -30, max: 110, initFreq: '24915000', publishBand: '1', startFreq: 24890000, endFreq: 24990000,  stepi: 1000, color: 'rgba(50, 168, 72, 0.6)', 
            modes: [
              { mode: MODES.CW, startFreq: 24890000, endFreq: 24914000 },
              { mode: MODES.USB, startFreq: 24915000, endFreq: 24990000 }]
	},
	{ ITU: 123,
	    name: '', min: -30, max: 110, initFreq: '', publishBand: '', startFreq: 24990000, endFreq: 25600000, stepi: 1000, color: '#ffffff00',
            modes: [{ mode: MODES.USB, startFreq: 24990000, endFreq: 25600000 }]
	},
	{ ITU: 123,
            name: '11m AM', min: -30, max: 55, initFreq: '', publishBand: '', startFreq: 25600000, endFreq: 26100000,  stepi: 5000, color: '#ffffff00', 
	    modes: [{ mode: MODES.AM, startFreq: 25600000, endFreq: 26100000 }]
	},
	{ ITU: 123,
	    name: '', min: -30, max: 55, initFreq: '', publishBand: '', startFreq: 26100000, endFreq: 26965000, stepi: 5000, color: '#ffffff00',
            modes: [{ mode: MODES.AM, startFreq: 26100000, endFreq: 26965000 }]
	},
	{ ITU: 1,
            name: 'CB', min: -30, max: 55, initFreq: '27335000', publishBand: '1', startFreq: 26965000, endFreq: 27405000, stepi: 5000, color: 'rgba(3, 227, 252, 0.6)',
            modes: [{ mode: MODES.AM, startFreq: 26965000, endFreq: 27405000 }]          
        },
        { ITU: 2,
            name: 'CB', min: -30, max: 55, initFreq: '', publishBand: '1', startFreq: 26965000, endFreq: 27405000, stepi: 1000, color: 'rgba(3, 227, 252, 0.6)',
            modes: [
              { mode: MODES.AM, startFreq: 26965000, endFreq: 27300000 },
              { mode: MODES.USB, startFreq: 27305000, endFreq: 27405000 }
          ]
        },
        { ITU: 123,
            name: '11m SSB', min: -30, max: 55, initFreq: '27665000', publishBand: '1', startFreq: 27405000, endFreq: 28000000, stepi: 1000, color: 'rgba(19, 106, 236, 0.6)',
            modes: [{ mode: MODES.USB, startFreq: 27405000, endFreq: 28000000 }]
        },
        { ITU: 123,
            name: '10m', min: -30, max: 60, initFreq: '28585000', publishBand: '1', startFreq: 28000000, endFreq: 29700000,  stepi: 1000, color: 'rgba(50, 168, 72, 0.6)', 
	    modes: [
              { mode: MODES.CW, startFreq: 28000000, endFreq: 28070000 },
              { mode: MODES.USB, startFreq: 28070000, endFreq: 29700000 }]
	},
// not processed below.
 	{ ITU: 123,
            name: '6m', min: -30, max: 110, initFreq: '50050000', publishBand: '1', startFreq: 50000000, endFreq: 54000000,  stepi: 1000, color: 'rgba(50, 168, 72, 0.6)', 
            modes: [
              { mode: MODES.CW, startFreq: 50000000, endFreq: 50100000 },
              { mode: MODES.USB, startFreq: 50100000, endFreq: 54000000 },
              { mode: MODES.FM, startFreq: 51110000, endFreq: 54000000 }]
	},
	{ ITU: 1,
            name: '4m', min: -30, max: 110, initFreq: '', publishBand: '1', startFreq: 70000000, endFreq: 70500000,  stepi: 1000, color: 'rgba(50, 168, 72, 0.6)', 
            modes: [{ mode: MODES.FM, startFreq: 70000000, endFreq: 70500000 }]
	},
  { ITU: 123,
    name: 'BFM', min: -30, max: 110, initFreq: '', publishBand: '1', startFreq: 80000000, endFreq: 110000000,  stepi: 25000, color: 'rgba(199, 12, 193, 0.6)', 
    modes: [{ mode: MODES.FM, startFreq: 80000000, endFreq: 110000000 }]
  },
  { ITU: 123,
    name: 'Air', min: -30, max: 110, initFreq: '', publishBand: '1', startFreq: 118000000, endFreq: 136000000,  stepi: 12500, color: 'rgba(19, 106, 236, 0.6)', 
    modes: [{ mode: MODES.AM, startFreq: 118000000, endFreq: 136000000 }]
  },
	{ ITU: 1,
            name: '2m', min: -30, max: 110, initFreq: '', publishBand: '1', startFreq: 144000000, endFreq: 146000000,  stepi: 12500, color: 'rgba(50, 168, 72, 0.6)',
            modes: [
              { mode: MODES.CW, startFreq: 144000000, endFreq: 144150000 },
              { mode: MODES.USB, startFreq: 144150000, endFreq: 144930000 },
              { mode: MODES.FM, startFreq: 144975000, endFreq: 146000000 }]
        },
	{ ITU: 2,
            name: '2m', min: -30, max: 110, initFreq: '', publishBand: '1', startFreq: 144000000, endFreq: 148000000,  stepi: 12500, color: 'rgba(50, 168, 72, 0.6)', 
            modes: [
              { mode: MODES.CW, startFreq: 144000000, endFreq: 144100000 },
              { mode: MODES.USB, startFreq: 144100000, endFreq: 144300000 },
              { mode: MODES.FM, startFreq: 144300000, endFreq: 148000000 }]
	},
  { ITU: 123,
    name: 'Marine', min: -30, max: 110, initFreq: '', publishBand: '1', startFreq: 156000000, endFreq: 163000000,  stepi: 12500, color: 'rgba(19, 106, 236, 0.6)', 
    modes: [{ mode: MODES.FM, startFreq: 156000000, endFreq: 163000000 }]
  },
  { ITU: 123,
    name: 'VHFserv', min: -30, max: 110, initFreq: '', publishBand: '1', startFreq: 163000000, endFreq: 174000000,  stepi: 12500, color: 'rgba(3, 227, 252, 0.6)', 
    modes: [{ mode: MODES.FM, startFreq: 163000000, endFreq: 174000000 }]
  },
	{ ITU: 2,
	    name: '1.25m', min: -30, max: 110, initFreq: '', publishBand: '1', startFreq: 220000000, endFreq: 225000000,  stepi: 12500, color: 'rgba(50, 168, 72, 0.6)',
            modes: [
              { mode: MODES.CW, startFreq: 222000000, endFreq: 222250000 },
              { mode: MODES.USB, startFreq: 222070000, endFreq: 222250000 },
              { mode: MODES.FM, startFreq: 222250000, endFreq: 225000000 }]
	},
	{ ITU: 1,
            name: '70cm', min: -30, max: 110, initFreq: '', publishBand: '1', startFreq: 430000000, endFreq: 440000000,  stepi: 125, color: 'rgba(50, 168, 72, 0.6)', 
            modes: [
              { mode: MODES.CW, startFreq: 430000000, endFreq: 430100000 },
              { mode: MODES.USB, startFreq: 430100000, endFreq: 432100000 },
              { mode: MODES.FM, startFreq: 432100000, endFreq: 440000000 }]
	},
	{ ITU: 2,
            name: '70cm', min: -30, max: 110, initFreq: '', publishBand: '1', startFreq: 420000000, endFreq: 450000000,  stepi: 125, color: 'rgba(50, 168, 72, 0.6)', 
            modes: [
              { mode: MODES.CW,  startFreq: 420000000, endFreq: 430100000 },
              { mode: MODES.USB, startFreq: 430100000, endFreq: 432100000 },
              { mode: MODES.FM,  startFreq: 432100000, endFreq: 450000000 }]
        },
];

// Export for use in other files
export { bands, MODES };
