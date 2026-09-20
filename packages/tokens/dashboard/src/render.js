/*
 * Renders the dashboard from the JSON block the command line tool wrote into
 * this file. Plain script, no build, no library: it has to run from a file on
 * disk with nothing to fetch, in whatever browser opens it.
 *
 * Every number in the data arrives already formatted by the tool, because the
 * tool is where the rounding rules live and where the two implementations are
 * held to the same bytes. This script lays things out and draws bars from the
 * central values; it never rounds a figure itself.
 */
(function () {
  'use strict';

  var raw = document.getElementById('buai-data');
  var app = document.getElementById('app');
  var data;
  try {
    data = JSON.parse(raw.textContent);
  } catch (cause) {
    app.textContent = 'The data block in this file could not be read. Run "betteruseofai dashboard" again.';
    return;
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (name) {
        if (name === 'class') node.className = attrs[name];
        else if (name === 'style') node.setAttribute('style', attrs[name]);
        else node.setAttribute(name, attrs[name]);
      });
    }
    (children || []).forEach(function (child) {
      if (child === null || child === undefined) return;
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });
    return node;
  }

  function svg(tag, attrs) {
    var node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.keys(attrs).forEach(function (name) {
      node.setAttribute(name, attrs[name]);
    });
    return node;
  }

  function num(value) {
    var parsed = parseFloat(value);
    return isFinite(parsed) ? parsed : 0;
  }

  function plural(count, one, many) {
    return count === 1 ? one : many;
  }

  /* ------------------------------------------------------------ readouts */

  function rangeBar(range) {
    var low = Math.max(num(range.low), 1e-9);
    var high = Math.max(num(range.high), 1e-9);
    var central = Math.max(num(range.central), 1e-9);
    var span = Math.log10(high) - Math.log10(low);
    var at = span <= 0 ? 50 : ((Math.log10(central) - Math.log10(low)) / span) * 100;
    var bar = el('div', {
      class: 'buai-rangebar',
      style: '--buai-low:0%;--buai-central:' + at.toFixed(1) + '%;--buai-high:100%',
      role: 'img',
      'aria-label': 'central figure ' + range.central + ', between ' + range.low + ' and ' + range.high,
    });
    bar.appendChild(el('div', { class: 'buai-rangebar__band' }));
    bar.appendChild(el('div', { class: 'buai-rangebar__hazard' }));
    bar.appendChild(el('div', { class: 'buai-rangebar__tick' }));
    return bar;
  }

  function readout(label, figure, range) {
    var group = el('div', { class: 'buai-readout-group' });
    if (!figure || !range) {
      group.appendChild(
        el('div', { class: 'buai-readout buai-readout--unknown' }, [
          el('span', { class: 'buai-readout__label' }, [label]),
          el('span', { class: 'buai-readout__figure' }, ['unknown']),
          el('span', { class: 'buai-readout__bounds' }, ['nothing we can stand behind']),
        ])
      );
      return group;
    }
    group.appendChild(
      el('div', { class: 'buai-readout' }, [
        el('span', { class: 'buai-readout__label' }, [label]),
        el('span', { class: 'buai-readout__figure' }, [
          figure.prefix + figure.value + ' ',
          el('span', { class: 'buai-readout__unit' }, [figure.unit]),
        ]),
        el('span', { class: 'buai-readout__bounds' }, ['[ ' + figure.low + ' to ' + figure.high + ' ]']),
      ])
    );
    group.appendChild(rangeBar(range));
    return group;
  }

  function metastrip(items) {
    return el(
      'div',
      { class: 'buai-metastrip' },
      items.map(function (item) {
        return el('span', { class: 'buai-metastrip__item' }, [item]);
      })
    );
  }

  /* ---------------------------------------------------------------- bars */

  function bars(rows, labelOf) {
    var peak = rows.reduce(function (top, row) {
      return Math.max(top, row.energyWh ? num(row.energyWh.central) : 0);
    }, 0);
    return el(
      'div',
      { class: 'buai-dash__bars' },
      rows.map(function (row) {
        var value = row.energyWh ? num(row.energyWh.central) : 0;
        var height = peak > 0 ? (value / peak) * 100 : 0;
        return el('div', { class: 'buai-dash__period' }, [
          el('div', { class: 'buai-dash__bar-track' }, [
            el('div', {
              class: row.energyWh ? 'buai-dash__bar' : 'buai-dash__bar buai-dash__bar--unknown',
              style: 'height:' + (row.energyWh ? height.toFixed(1) : '100') + '%',
              title: row.count + ' ' + plural(row.count, 'turn', 'turns') + ', ' + row.text.energy,
            }),
          ]),
          el('span', { class: 'buai-dash__periodlabel' }, [labelOf(row)]),
          el('span', { class: 'buai-dash__periodvalue' }, [row.text.energy]),
        ]);
      })
    );
  }

  function meter(share) {
    var cells = Math.max(0, Math.min(10, Math.floor(num(share) * 10 + 0.5)));
    var box = el('span', { class: 'buai-dash__meter', role: 'img', 'aria-label': Math.round(num(share) * 100) + ' per cent' });
    for (var index = 0; index < 10; index += 1) {
      box.appendChild(el('span', { class: index < cells ? 'buai-dash__cell buai-dash__cell--on' : 'buai-dash__cell' }));
    }
    return box;
  }

  function table(headers, rows) {
    var head = el('tr', null, headers.map(function (header) {
      return el('th', { scope: 'col', style: header.right ? 'text-align:right' : '' }, [header.text]);
    }));
    var body = el('tbody', null, rows.map(function (cells) {
      return el('tr', null, cells.map(function (cell) {
        return el('td', { class: cell.num ? 'buai-num' : '' }, cell.nodes || [cell.text]);
      }));
    }));
    return el('div', { class: 'buai-scroll-x' }, [
      el('table', { class: 'buai-table' }, [el('thead', null, [head]), body]),
    ]);
  }

  function section(title, children) {
    return el('section', null, [el('h2', null, [title])].concat(children));
  }

  /* --------------------------------------------------------------- rings */

  function rings(saving) {
    var total = saving.energyWh ? num(saving.energyWh.central) : 0;
    var inner = 14;
    var room = 78;
    var radius = inner;
    var picture = svg('svg', {
      class: 'buai-dash__rings',
      viewBox: '0 0 200 200',
      role: 'img',
      'aria-label': saving.byDay.length + ' rings, one per day, growing with the energy saved that day',
    });
    picture.appendChild(svg('circle', { cx: 100, cy: 100, r: inner, class: 'buai-dash__ring buai-dash__ring--core' }));
    saving.byDay.forEach(function (day) {
      var share = total > 0 && day.energyWh ? num(day.energyWh.central) / total : 0;
      var grow = share * room;
      radius += Math.max(1.5, grow);
      picture.appendChild(
        svg('circle', {
          cx: 100,
          cy: 100,
          r: radius.toFixed(2),
          class: grow > 1.5 ? 'buai-dash__ring buai-dash__ring--grew' : 'buai-dash__ring',
        })
      );
    });

    var note =
      'Against ' +
      saving.baseline +
      ', priced on the same rows, region and boundary as everything else here. A turn that was already on the largest model saved nothing.';
    if (saving.skipped > 0) {
      note +=
        ' ' +
        saving.skipped +
        ' ' +
        plural(saving.skipped, 'turn', 'turns') +
        ' could not be re-priced and ' +
        plural(saving.skipped, 'is', 'are') +
        ' not in the figure.';
    }

    return section('What smaller models saved', [
      el('div', { class: 'buai-dash__saving-row' }, [
        picture,
        el('div', null, [
          readout('Energy not drawn', saving.readout.energy, saving.energyWh),
          el('p', { class: 'buai-dash__note' }, [note]),
        ]),
      ]),
    ]);
  }

  /* ---------------------------------------------------------------- page */

  var coverage = data.coverage;
  var totals = data.totals;
  var settings = data.settings;

  app.textContent = '';

  app.appendChild(el('h1', null, ['What your sessions have cost']));
  app.appendChild(
    el('p', { class: 'buai-dash__lede' }, [
      'Every turn of your coding sessions, priced on your own machine from the dataset the tool shipped with. Nothing in this file was fetched from anywhere, and nothing about it left your machine.',
    ])
  );

  if (!totals || totals.count === 0) {
    app.appendChild(
      el('div', { class: 'buai-standby' }, [
        el('span', { class: 'buai-standby__code' }, ['empty']),
        'No turns were found. Run a session in Claude Code or Codex, then "betteruseofai dashboard" again.',
      ])
    );
    return;
  }

  app.appendChild(
    metastrip([
      coverage.turns + ' ' + plural(coverage.turns, 'turn', 'turns'),
      coverage.sessions + ' ' + plural(coverage.sessions, 'session', 'sessions'),
      coverage.from.slice(0, 10) + ' to ' + coverage.to.slice(0, 10),
      'dataset ' + data.header.datasetVersion,
      'region ' + settings.region,
      'water ' + settings.waterScope,
      'telemetry: none',
    ])
  );

  app.appendChild(
    el('div', { class: 'buai-dash__readouts', style: 'margin-top:var(--space-6)' }, [
      readout('Energy', totals.readout.energy, totals.energyWh),
      readout('Water', totals.readout.water, totals.waterMl),
      readout('Carbon', totals.readout.carbon, totals.carbonG),
    ])
  );

  var coverageText =
    coverage.fromTranscripts +
    ' ' +
    plural(coverage.fromTranscripts, 'turn was', 'turns were') +
    ' read from transcripts still on disk';
  if (coverage.fromLogOnly > 0) {
    coverageText +=
      ', and ' +
      coverage.fromLogOnly +
      ' ' +
      plural(coverage.fromLogOnly, 'is', 'are') +
      ' known only from the log, because the transcript has since been deleted.';
  } else {
    coverageText += '. Nothing yet rests on the log alone.';
  }
  if (coverage.logWarn) {
    coverageText +=
      ' The log has grown to ' +
      coverage.logMb +
      ' MB. Run "betteruseofai prune --before <date>" to trim it.';
  }
  app.appendChild(el('p', { class: 'buai-dash__note' }, [coverageText]));

  if (data.caveats && data.caveats.length > 0) {
    app.appendChild(
      el('ul', { class: 'buai-dash__caveats' }, data.caveats.map(function (line) {
        return el('li', null, [line]);
      }))
    );
  }

  if (data.byWeek.length > 0) {
    app.appendChild(
      section('Every week', [
        bars(data.byWeek, function (row) {
          return row.key.slice(5);
        }),
        el('p', { class: 'buai-dash__note' }, ['One bar per week, labelled by the Monday it starts on. The height is the central energy figure; a dashed bar is a week where nothing could be priced.']),
      ])
    );
  }

  var recentDays = data.byDay.slice(-30);
  if (recentDays.length > 0) {
    app.appendChild(
      section(recentDays.length < data.byDay.length ? 'The last thirty days with sessions' : 'Every day', [
        bars(recentDays, function (row) {
          return row.key.slice(5);
        }),
      ])
    );
  }

  if (data.saving) app.appendChild(rings(data.saving));

  app.appendChild(
    section('Which models', [
      table(
        [{ text: 'Model' }, { text: 'Turns', right: true }, { text: 'Share' }, { text: 'Energy', right: true }, { text: 'Water', right: true }, { text: 'Carbon', right: true }],
        data.byModel.map(function (row) {
          return [
            { text: row.key === 'unknown' ? 'a model we do not recognise' : row.name },
            { text: String(row.count), num: true },
            { nodes: [meter(row.share), el('span', { class: 'buai-mono buai-dash__muted' }, [Math.round(num(row.share) * 100) + '%'])] },
            { text: row.text.energy, num: true },
            { text: row.text.water, num: true },
            { text: row.text.carbon, num: true },
          ];
        })
      ),
    ])
  );

  if (data.bySurface.length > 1) {
    app.appendChild(
      section('By tool', [
        table(
          [{ text: 'Tool' }, { text: 'Turns', right: true }, { text: 'Energy', right: true }, { text: 'Water', right: true }, { text: 'Carbon', right: true }],
          data.bySurface.map(function (row) {
            return [
              { text: row.key },
              { text: String(row.count), num: true },
              { text: row.text.energy, num: true },
              { text: row.text.water, num: true },
              { text: row.text.carbon, num: true },
            ];
          })
        ),
      ])
    );
  }

  if (data.sessions.length > 0) {
    app.appendChild(
      section('Heaviest sessions', [
        table(
          [{ text: 'Session' }, { text: 'First turn' }, { text: 'Turns', right: true }, { text: 'Most used' }, { text: 'Energy', right: true }],
          data.sessions.map(function (row) {
            return [
              { nodes: [el('span', { class: 'buai-mono' }, [row.key])] },
              { text: row.from.slice(0, 10) },
              { text: String(row.count), num: true },
              { text: row.topModel === 'unknown' ? 'a model we do not recognise' : row.topModel },
              { text: row.text.energy, num: true },
            ];
          })
        ),
        el('p', { class: 'buai-dash__note' }, ['Run "betteruseofai session <id>" for one session in full, with its heaviest turns and the sources each figure rests on.']),
      ])
    );
  }

  if (data.projects === null) {
    app.appendChild(
      section('Projects and branches', [
        el('p', { class: 'buai-dash__note' }, [
          'Left out. Directory names and branch names are the sort of thing a screenshot carries further than intended, so they stay out unless asked for: run "betteruseofai dashboard --with-projects".',
        ]),
      ])
    );
  } else {
    app.appendChild(
      section('Projects and branches', [
        table(
          [{ text: 'Project' }, { text: 'Branch' }, { text: 'Turns', right: true }, { text: 'Energy', right: true }],
          data.projects.map(function (row) {
            return [
              { nodes: [el('span', { class: 'buai-mono' }, [row.project])] },
              { nodes: [el('span', { class: 'buai-mono' }, [row.branch === null ? 'no branch recorded' : row.branch])] },
              { text: String(row.count), num: true },
              { text: row.text.energy, num: true },
            ];
          })
        ),
        el('p', { class: 'buai-dash__note' }, ['The last part of the working directory, and the branch the transcript recorded. Older turns carry no branch.']),
      ])
    );
  }

  var comparisons = [];
  ['energy', 'water', 'carbon'].forEach(function (quantity) {
    (data.equivalents[quantity] || []).forEach(function (one) {
      comparisons.push(
        el('li', null, [
          el('span', { class: 'buai-dash__quantity' }, [quantity]),
          one.text + ' ' + one.label + (one.stale ? ', from a figure marked stale' : ''),
        ])
      );
    });
  });
  if (comparisons.length > 0) {
    app.appendChild(section('Put another way', [el('ul', { class: 'buai-dash__equivalents' }, comparisons)]));
  }

  app.appendChild(
    el('p', { class: 'buai-dash__foot' }, [
      'An estimate, not a measurement. Every figure is a range because the published measurements disagree, and every range rests on sources the tool can show you: "betteruseofai session <id>" lists them. How the figures are worked out is at ',
      el('a', { href: 'https://betteruseofai.org/methodology', rel: 'external noreferrer' }, ['betteruseofai.org/methodology']),
      '. Written ' + data.header.generatedAt.slice(0, 16).replace('T', ' ') + ' UTC.',
    ])
  );
})();
