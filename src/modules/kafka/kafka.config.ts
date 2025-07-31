export const kafkaConfig = {
  brokers: process.env.KAFKA_BROKERS
    ? process.env.KAFKA_BROKERS.split(',')
    : ['localhost:9092'],
  clientId: process.env.KAFKA_CLIENT_ID || 'default-client-id',
  groupId: process.env.KAFKA_GROUP_ID || 'default-group-id',
};
