import marshal
import sqlite3
from flask import Flask
from flask import request
from flask import jsonify
from flask import render_template
from flask import g
from flask import send_file
import geohash
from pushjack import APNSSandboxClient


PRECISION = 7

app = Flask(__name__)

apple_client = APNSSandboxClient(
    certificate='pushcert.pem',
    default_error_timeout=10,
    default_expiration_offset=2592000,
    default_batch_size=100
)

def send_apple_push(token, alert, title):
    res = apple_client.send(
        token,
        alert,
        title=title,
        extra={'geohash': 'dr5rsw6'}
    )
    print(res.errors)

def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect('PREDICTIONS.db')
    return db


@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()


@app.route("/")
def home():
    return render_template('index.html')

@app.route("/display")
def display():
    return render_template('display.html')


@app.route("/leaf")
def leaf():
    return render_template('index_leaflet.html')

@app.route("/sw.js")
def sw():
    return send_file('static/js/sw.js')

@app.route("/api/allpoints")
def allpoints():
    data = predictor.allpoints()
    return jsonify(data)


@app.route("/about_mobile")
def about_mobile():
    return render_template('about_mobile.html')


@app.route("/api/details_html")
def details_html():
    return render_template('details.html')


@app.route("/api/details")
def details():
    ghash = request.args.get('geohash')
    c = get_db().cursor()
    c.execute('SELECT * FROM predictions WHERE hash=?', [ghash])
    result = c.fetchone()

    if result:
        c.execute('SELECT name, lat, lng FROM organizations WHERE hash=?', [ghash])
        organizations = c.fetchall()

        c.execute('SELECT url FROM suspects WHERE hash=?', [ghash])
        suspects = [s[0] for s in c.fetchall()]
        print(suspects)

        return jsonify({
            'crime': result[1],
            'fine_bins': marshal.loads(result[4]),
            'top': marshal.loads(result[5]),
            'organizations': organizations,
            'suspects': suspects
        })
    else:
        return jsonify({})


@app.route("/api/check_safety", methods=["POST", "GET"])
def check_safety():
    content = request.get_json(silent=True)
    print(content)
    token = content.get('token')
    try:
        ghash = geohash.encode(content['location']['lat'], content['location']['lng'], PRECISION)
    except:
        ghash = geohash.encode(content['location']['coords']['latitude'], content['location']['coords']['longitude'], PRECISION)
    
    danger = content.get('danger', 0.8)

    c = get_db().cursor()
    c.execute('SELECT crime FROM predictions WHERE crime >= ? AND hash=?', (danger, ghash))
    danger = len(c.fetchall()) > 0

    if danger is True and token:
        res = apple_client.send(
            token,
            None,
            content_available=True,
            extra={'geohash': geohash, 'silent': True}
        )

    print(danger)
    return jsonify({'danger': danger})


@app.route("/api/risks")
def everything():
    bbox = None

    n = request.args.get('n')
    s = request.args.get('s')
    e = request.args.get('e')
    w = request.args.get('w')

    if n and s and e and w:
        bbox = {'n': float(n), 's': float(s), 'e': float(e), 'w': float(w)}

    c = get_db().cursor()
    # c.execute('SELECT hash, crime FROM predictions WHERE crime > 0.2 AND lat < ? AND lat > ? AND lng < ? AND lng > ?', (bbox['n'], bbox['s'], bbox['e'], bbox['w']))
    c.execute('SELECT hash, crime FROM predictions WHERE crime > 0.2 AND lat <= ? AND lat >= ? AND lng <= ? AND lng >= ?', (bbox['n'], bbox['s'], bbox['e'], bbox['w']))

    data = [{'h': i[0], 'p': i[1]} for i in c.fetchall()]
    return jsonify(data)


@app.route("/api/heatmap")
def heatmap():
    c = get_db().cursor()
    c.execute("SELECT hash, crime FROM predictions WHERE crime > 0.8")
    data = c.fetchall()
    return jsonify(data)


@app.route("/api/allsuspects")
def allsuspects():
    c = get_db().cursor()
    c.execute("SELECT suspects.hash, url, crime FROM suspects LEFT JOIN predictions ON predictions.hash=suspects.hash")
    data = c.fetchall()
    return jsonify(data)


@app.route("/api/heatmap_all")
def heatmap_all():
    c = get_db().cursor()
    c.execute("SELECT hash, crime FROM predictions WHERE crime > 0.4")
    data = c.fetchall()
    return jsonify(data)

@app.route("/api/predict")
def predict():
    lat = float(request.args.get('lat'))
    lng = float(request.args.get('lng'))
    data = predictor.predict(lat, lng)
    return jsonify(data)


if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0')
