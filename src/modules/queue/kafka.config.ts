const kafkaConfig = {
  brokers: process.env.KAFKA_BROKERS
    ? process.env.KAFKA_BROKERS.split(',')
    : ['localhost:9092'],
  clientId: process.env.KAFKA_CLIENT_ID || 'deep-eyes-backend',
  groupId: process.env.KAFKA_GROUP_ID || 'queue-consumer-group',
};

export default kafkaConfig;
