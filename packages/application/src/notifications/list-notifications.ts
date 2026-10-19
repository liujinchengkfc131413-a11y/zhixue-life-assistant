export interface NotificationReader<T> {
  list(): readonly T[];
}
export class ListNotifications<T> {
  public constructor(private readonly reader: NotificationReader<T>) {}
  public execute(): readonly T[] {
    return this.reader.list();
  }
}
