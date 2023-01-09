import random
import json
import geohash

PRECISION = 7

with open('../finra/PREDICTIONS_processed1.json', 'r') as infile:
# with open('../finra/PREDICTIONS_original.json', 'r') as infile:
    predictions = json.load(infile)

predictions['predictions'] = {k: v for k,v in predictions['predictions'].items() if v['crime'] > 0.1}


def predict(lat, lng):
    ghash = geohash.encode(lat, lng, PRECISION)
    return predictions['predictions'].get(ghash, {})


def heatmap(minCrime = 0.8):
    output = []
    for ghash, pred in predictions['predictions'].items():
        lat, lng = geohash.decode(ghash)
        if pred['crime'] >= minCrime:
            weight = pred['crime'] * 10
            output.append([lat, lng, weight])
    return output


def allpoints():
    output = []
    for ghash, pred in predictions['predictions'].items():
        item = {}
        lat, lng = geohash.decode(ghash)
        item['lat'] = lat
        item['lng'] = lng
        item['$'] = pred['fine'] # pred['fine_bins']
        item['p'] = pred['crime']

        # item['c'] = pred['crime_type']
        # item['l'] = pred['crime_likelihood']
        output.append(item)
    return output


def everything(bbox=None):
    # return [{
    #          'c': geohash.bbox(ghash),
    #          'p': pred['crime'],
    #          '$': pred['fine_bins'],
    #          't': pred['top']
    #         }
    #         for ghash, pred in predictions['predictions'].items()
    #         if ghash[:4] == gh[:4] or bbox is None
    #        ]
    output = []
    for ghash, pred in predictions['predictions'].items():
        lat, lng = geohash.decode(ghash)
        if bbox is None or (lat < bbox['n'] and lat > bbox['s'] and lng < bbox['e'] and lng > bbox['w']):
            item = {}
            item['c'] = geohash.bbox(ghash)
            item['p'] = pred['crime']
            # item['$'] = pred['fine'] # pred['fine_bins']
            item['$'] = pred['fine_bins'] # pred['fine_bins']
            item['t'] = pred['top']
            # item['l'] = pred['crime_likelihood']
            output.append(item)
    return output


def generate_geojson():
    features = []
    for ghash, pred in predictions['predictions'].items():
        coords = geohash.bbox(ghash)
        fine = pred['fine']
        prob = pred['crime']
        item = {
            'type': 'Feature',
            'geometry': {
                'type': 'Polygon',
                'coordinates': [[
                    [coords['n'], coords['w']], [coords['n'], coords['e']], [coords['s'], coords['e']], [coords['s'], coords['w']], [coords['n'], coords['w']]
                ]]
            },
            'properties': {
                'fine': fine,
                'prob': prob
            }

        }
        features.append(item)

    output = {
        'type': 'FeatureCollection',
        'features': features
    }

    with open('crimes.geojson', 'w') as outfile:
        json.dump(output, outfile)



def fake(lat, lng):
    output = {
        'danger_level': random.random(),
        'blocks': []
    }

    total = random.randint(5, 10)

    for i in range(0, total):
        tlat = lat + random.random() / 20
        tlng = lng + random.random() / 20

        path = [
          [tlat - .001, tlng - .001],
          [tlat - .001, tlng + .001],
          [tlat + .001, tlng + .001],
          [tlat + .001, tlng - .001]
        ]

        item = {
            'path': path,
            'text': 'some text ' + str(i),
            'danger_level': random.random()
        }

        output['blocks'].append(item)

    return output


if __name__ == '__main__':
    generate_geojson()
