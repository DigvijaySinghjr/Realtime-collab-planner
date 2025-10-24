import jwt from 'jsonwebtoken';


const token = jwt.sign({
  data: 'random generated data for jwt token'
}, 'secret1', { expiresIn: 60*1 });

console.log('Generated JWT Token:');
console.log(token);


jwt.verify(token, 'secret1', function(err, decoded) {

  console.log(decoded);
});


