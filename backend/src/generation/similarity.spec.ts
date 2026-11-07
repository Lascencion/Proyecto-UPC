import { similarityScores, tokenize } from './similarity';

describe('similarity', () => {
  it('normaliza tildes, plurales y palabras vacías', () => {
    expect(tokenize('Las Compras de monedas con cupones')).toEqual(['compra', 'moneda', 'cupon']);
  });

  it('ordena primero los documentos más parecidos a la consulta', () => {
    const query = 'Compra de monedas virtuales aplicando un cupón de descuento';
    const docs = [
      'Historial de compras del jugador',
      'Vigencia de cupones de descuento: un cupón vencido no se aplica en la compra de monedas',
      'Recuperación de contraseña por correo',
    ];
    const scores = similarityScores(query, docs);
    expect(scores[1]).toBeGreaterThan(scores[0]);
    expect(scores[0]).toBeGreaterThan(scores[2]);
    expect(scores[2]).toBe(0);
    scores.forEach((s) => expect(s).toBeLessThanOrEqual(1));
  });
});
