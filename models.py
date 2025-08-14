from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.sql import func
from flask_bcrypt import Bcrypt

db = SQLAlchemy()
bcrypt = Bcrypt()

class User(db.Model):
    __tablename__ = 'ms_users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='user') # 'user' or 'admin'
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())

    def set_password(self, password):
        self.password_hash = bcrypt.generate_password_hash(password).decode('utf-8')

    def check_password(self, password):
        return bcrypt.check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'role': self.role,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class Meeting(db.Model):
    __tablename__ = 'ms_meetings'
    id = db.Column(db.Integer, primary_key=True)
    topic = db.Column(db.String(255), nullable=False)
    meeting_date = db.Column(db.DateTime(timezone=True), nullable=False)
    created_by_id = db.Column(db.Integer, db.ForeignKey('ms_users.id'), nullable=True) # Allow null for now
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    
    creator = db.relationship('User', backref=db.backref('meetings', lazy=True))
    action_items = db.relationship('ActionItem', backref='meeting', lazy='dynamic', cascade="all, delete-orphan")

    def to_dict(self):
        return {
            'id': self.id,
            'topic': self.topic,
            'meeting_date': self.meeting_date.isoformat() if self.meeting_date else None,
            'created_by_id': self.created_by_id,
            'creator_username': self.creator.username if self.creator else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'action_item_count': self.action_items.count()
        }

class ActionItem(db.Model):
    __tablename__ = 'ms_action_items'
    id = db.Column(db.Integer, primary_key=True)
    meeting_id = db.Column(db.Integer, db.ForeignKey('ms_meetings.id'), nullable=False)
    item = db.Column(db.Text, nullable=True)
    action = db.Column(db.Text, nullable=False)
    owner_id = db.Column(db.Integer, db.ForeignKey('ms_users.id'), nullable=True) # Allow null for now
    due_date = db.Column(db.Date, nullable=True)
    status = db.Column(db.String(50), nullable=False, default='pending') # e.g., 'pending', 'in_progress', 'completed'
    attachment_path = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())

    owner = db.relationship('User', backref=db.backref('action_items', lazy=True))

    def to_dict(self):
        return {
            'id': self.id,
            'meeting_id': self.meeting_id,
            'meeting_topic': self.meeting.topic if self.meeting else None,
            'item': self.item,
            'action': self.action,
            'owner_id': self.owner_id,
            'owner_name': self.owner.username if self.owner else None,
            'due_date': self.due_date.isoformat() if self.due_date else None,
            'status': self.status,
            'attachment_path': self.attachment_path,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
